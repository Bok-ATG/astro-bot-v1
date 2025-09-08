// the analyzer - watches conversations and makes sense of them

const { OpenAI } = require('openai');
const cron = require('node-cron');
const log = require('../utils/log');
const config = require('../config');
const Checkpoints = require('../utils/checkpoint'); 

class SummaryBot {
  constructor(slackClient) {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
    this.slackClient = slackClient;
    this.channelId = config.SLACK_CHANNEL_ID;

    this.messageHistoryHours = config.MESSAGE_HISTORY_HOURS;
    this.summarySchedule = config.SUMMARY_SCHEDULE;

    this.weeklySchedule = config.SUMMARY_SCHEDULE_WEEKLY; 
    this.minMessages = config.SUMMARY_MIN_MESSAGES ?? 6;
    this.minUniqueUsers = config.SUMMARY_MIN_UNIQUE_USERS ?? 2;
    this.gapMinutes = config.SUMMARY_GAP_MINUTES ?? 90;

    this.checkpoints = new Checkpoints(config.CHECKPOINT_PATH);
    if (this.checkpoints.get('weekly') === undefined) this.checkpoints.set('weekly', null);
    if (this.checkpoints.get('manual') === undefined) this.checkpoints.set('manual', null);
  
    this.setupScheduledWeeklySummary();  

    log.bot('summary', 'ready to stalk your conversations (for science) — since-last-summary mode enabled');
  }
  computeStats(messages) {
    const uniqueUsers = new Set(messages.map(m => m.user).filter(Boolean));
    const firstTs = messages[0]?.ts ? new Date(parseFloat(messages[0].ts) * 1000).toISOString() : null;
    const lastTs  = messages.at(-1)?.ts ? new Date(parseFloat(messages.at(-1).ts) * 1000).toISOString() : null;
    return { messageCount: messages.length, uniqueUserCount: uniqueUsers.size, firstTs, lastTs };
  }

  segmentByGap(messages, gapMinutes = this.gapMinutes) {
    const groups = [];
    let current = [];
    const gapMs = gapMinutes * 60 * 1000;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const ts = new Date(parseFloat(msg.ts) * 1000);
      const prev = i > 0 ? new Date(parseFloat(messages[i - 1].ts) * 1000) : null;
      const dayChanged = i > 0 && ts.toDateString() !== prev.toDateString();
      const bigGap = prev && (ts - prev) > gapMs;

      if (current.length && (bigGap || dayChanged)) {
        groups.push(current);
        current = [];
      }
      current.push(msg);
    }
    if (current.length) groups.push(current);
    return groups;
  }

  async fetchChannelHistory(hoursAgo = this.messageHistoryHours, oldestTsSec = undefined) {
    try {
      const now = new Date();
      const usingOldest = oldestTsSec !== undefined;

      const oldest = usingOldest
        ? new Date(oldestTsSec * 1000)
        : new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

      log.bot('summary', usingOldest
        ? `Fetching conversation history since checkpoint: ${oldest.toISOString()}`
        : `Fetching ${hoursAgo} hours of conversation history`);

      log.debug('Time range', { from: oldest.toISOString(), to: now.toISOString() });

      // Initial fetch
      const result = await this.slackClient.conversations.history({
        channel: this.channelId,
        oldest: (oldest.getTime() / 1000).toString(),
        limit: 200, // bumped to 200
      });

      let messages = result.messages || [];
      let cursor = result.response_metadata?.next_cursor;

      while (cursor) {
        log.debug('Fetching additional message page');
        const nextPage = await this.slackClient.conversations.history({
          channel: this.channelId,
          cursor,
          limit: 200,
        });

        messages = messages.concat(nextPage.messages || []);
        cursor = nextPage.response_metadata?.next_cursor;
      }

      const userMessages = messages
        .filter(msg => !msg.bot_id && !msg.subtype)
        .sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

      log.success(`Retrieved ${userMessages.length} user messages for analysis`);
      return userMessages;
    } catch (error) {
      log.error('Failed to fetch channel history', error);
      return [];
    }
  }

  async enrichMessagesWithUserInfo(messages) {
    try {
      const userCache = new Map();
      log.bot('summary', 'Enriching messages with user information');

      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        if (!msg.user) {
          return {
            ...msg,
            userName: 'unknown',
            timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
          };
        }

        if (!userCache.has(msg.user)) {
          try {
            const userInfo = await this.slackClient.users.info({ user: msg.user });
            const userName = userInfo.user.real_name || userInfo.user.name || msg.user;
            userCache.set(msg.user, userName);
          } catch (error) {
            log.warning(`Could not fetch info for user ${msg.user}`, error.message);
            userCache.set(msg.user, msg.user);
          }
        }

        return {
          ...msg,
          userName: userCache.get(msg.user),
          timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
        };
      }));

      log.success('Message enrichment completed');
      return enrichedMessages;
    } catch (error) {
      log.error('Error enriching messages with user info', error);
      return messages;
    }
  }

  async generateSummaryAndQuestions(messages) {
    const stats = this.computeStats(messages);

    if (stats.messageCount === 0) {
      return {
        insufficient: true,
        insufficient_reason: "No user messages in range.",
        summary: "Quiet period with limited activity; not enough to synthesize a reliable summary.",
        questions: [],
        concept_trends: [],
        metacognitive_insights: "",
        unresolved_issues: [],
        stats
      };
    }

    const meetsThresholds =
      stats.messageCount >= this.minMessages &&
      stats.uniqueUserCount >= this.minUniqueUsers;

    const groups = this.segmentByGap(messages, this.gapMinutes);
    const formattedMessages = groups.map((group, idx) => {
      const lines = group.map(msg =>
        `[${msg.timestamp}] ${msg.userName}: ${(msg.text || '').replace(/\s+/g, ' ').trim()}`
      ).join('\n');
      return `=== Segment ${idx + 1} ===\n${lines}`;
    }).join('\n\n');

    try {
      log.openai('Generating conversation analysis and insights');

      const systemPrompt = `
FUNCTION
Analyze Slack channel conversation data. Be strictly evidence-bound; avoid speculation.

OUTPUT JSON SHAPE
{
  "summary": string,                   // <= 250 words, chronological if multiple segments
  "concept_trends": string[],          // evidence-backed patterns
  "metacognitive_insights": string,    // grounded in observed messages
  "questions": string[],               // 3–5 targeted follow-ups
  "unresolved_issues": string[],
  "insufficient": boolean,
  "insufficient_reason": string,
  "stats": { "messageCount": number, "uniqueUserCount": number, "firstTs": string, "lastTs": string }
}

RULES
- If evidence is thin (few messages or one participant), set "insufficient": true and keep arrays empty.
- Quote only short snippets (<=15 words) when citing.
- Eliminate subjective language; focus on observable patterns.
      `;

      const userPrompt = `
STATS
- messageCount: ${stats.messageCount}
- uniqueUserCount: ${stats.uniqueUserCount}
- firstTimestamp: ${stats.firstTs}
- lastTimestamp: ${stats.lastTs}
- meetsThresholds: ${meetsThresholds}

MESSAGES (chronological, segmented by inactivity/day change):
${formattedMessages}
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content);

      if (!meetsThresholds) {
        return {
          insufficient: true,
          insufficient_reason: result.insufficient_reason || "Activity below minimum thresholds.",
          summary: "Quiet period with limited activity; not enough to synthesize a reliable summary.",
          questions: [],
          concept_trends: [],
          metacognitive_insights: "",
          unresolved_issues: [],
          stats
        };
      }

      log.success('Analysis completed successfully');
      return {
        insufficient: !!result.insufficient,
        insufficient_reason: result.insufficient_reason || "",
        summary: result.summary || "No summary generated.",
        questions: Array.isArray(result.questions) ? result.questions : [],
        unresolved_issues: Array.isArray(result.unresolved_issues) ? result.unresolved_issues : [],
        concept_trends: Array.isArray(result.concept_trends) ? result.concept_trends : [],
        metacognitive_insights: result.metacognitive_insights || "",
        stats
      };
    } catch (error) {
      log.error('Failed to generate summary and analysis', error);
      return {
        insufficient: true,
        insufficient_reason: "OpenAI error",
        summary: "Error generating summary.",
        questions: [],
        unresolved_issues: [],
        concept_trends: [],
        metacognitive_insights: "",
        stats
      };
    }
  }

  formatSlackMessage(data, header = '*Channel Activity Analysis*') {
    const { summary, questions, unresolved_issues, concept_trends, metacognitive_insights, insufficient, insufficient_reason, stats } = data;

    if (insufficient) {
      let message = `*Channel Activity Status*\n\n`;
      message += `📭 Quiet period.`;
      message += `\n_Generated ${new Date().toISOString()}_`;
      return message;
    }

    let message = `${header}\n\n`;
    message += `*Summary:*\n${summary}\n\n`;

    if (concept_trends && concept_trends.length > 0) {
      message += `*🔍 Question Patterns:*\n`;
      concept_trends.forEach((trend) => {
        message += `• ${trend}\n`;
      });
      message += '\n';
    }

    if (metacognitive_insights) {
      message += `*🧠 Learning Analysis:*\n${metacognitive_insights}\n\n`;
    }

    if (questions && questions.length > 0) {
      message += `*💡 Discussion Questions:*\n`;
      questions.forEach((q, i) => {
        message += `${i+1}. ${q}\n`;
      });
      message += '\n';
    }

    if (unresolved_issues && unresolved_issues.length > 0) {
      message += `*⚠️ Unresolved Issues:*\n`;
      unresolved_issues.forEach((issue) => {
        message += `• ${issue}\n`;
      });
    }

    message += `\n_Generated ${new Date().toISOString()}_`;
    return message;
  }

  async generateAndPostSummary({ oldestTsSec, header }) {
    try {
      log.bot('summary', 'Starting comprehensive channel analysis');

      const messages = await this.fetchChannelHistory(this.messageHistoryHours, oldestTsSec);
      if (messages.length === 0) {
        log.info('No messages found in specified range; posting quiet status');
        const quiet = {
          insufficient: true,
          insufficient_reason: "No user messages in range.",
          summary: "Quiet period with limited activity; not enough to synthesize a reliable summary.",
          questions: [],
          unresolved_issues: [],
          concept_trends: [],
          metacognitive_insights: "",
          stats: this.computeStats(messages)
        };
        const formattedQuiet = this.formatSlackMessage(quiet, header || '*Channel Activity Status*');
        await this.slackClient.chat.postMessage({
          channel: this.channelId,
          text: formattedQuiet,
          unfurl_links: false,
          unfurl_media: false
        });
        return;
      }

      const enrichedMessages = await this.enrichMessagesWithUserInfo(messages);
      const summaryData = await this.generateSummaryAndQuestions(enrichedMessages);
      const formattedMessage = this.formatSlackMessage(summaryData, header || '*Channel Activity Analysis*');

      log.slack('Posting analysis to channel');
      await this.slackClient.chat.postMessage({
        channel: this.channelId,
        text: formattedMessage,
        unfurl_links: false,
        unfurl_media: false
      });

      log.success('Channel analysis posted successfully');
    } catch (error) {
      log.error('Failed to generate and post summary', error);
    }
  }

  async runWeeklySummary() {
    const lastWeeklyIso = this.checkpoints.get('weekly');
    const oldestTsSec = lastWeeklyIso ? Math.floor(new Date(lastWeeklyIso).getTime() / 1000) : undefined;

    await this.generateAndPostSummary({
      oldestTsSec,
      header: '*Weekly Channel Summary*'
    });

    this.checkpoints.set('weekly', new Date().toISOString());
  }

  async runManualSummary(triggerChannel, replyToTs) {
    const weeklyIso = this.checkpoints.get('weekly');
    const manualIso = this.checkpoints.get('manual');

    const startIso = [weeklyIso, manualIso].filter(Boolean).sort().at(-1) || null;
    const oldestTsSec = startIso ? Math.floor(new Date(startIso).getTime() / 1000) : undefined;

    await this.slackClient.chat.postMessage({
      channel: triggerChannel,
      thread_ts: replyToTs,
      text: "🔄 Summarizing messages since the last summary checkpoint..."
    });

    await this.generateAndPostSummary({
      oldestTsSec,
      header: '*On-Demand Channel Summary*'
    });

    this.checkpoints.set('manual', new Date().toISOString());
  }

  setupScheduledSummaries() {
    if (this.summarySchedule) {
      cron.schedule(this.summarySchedule, async () => {
        log.info('Scheduled summary generation triggered (legacy interval)');
        await this.generateAndPostSummary({ oldestTsSec: undefined, header: '*Scheduled Channel Summary*' });
      });
      log.info(`Scheduled summaries configured: ${this.summarySchedule}`);
    }
  }

  setupScheduledWeeklySummary() {
    if (this.weeklySchedule) {
      cron.schedule(this.weeklySchedule, async () => {
        log.info('Scheduled weekly summary triggered');
        await this.runWeeklySummary();
      });
      log.info(`Weekly summaries configured: ${this.weeklySchedule}`);
    }
  }

  async handleSummaryRequest(event) {
    const text = event.text?.toLowerCase() || '';
    const summaryTriggers = ['summary please', 'summarize channel', 'channel summary', 'generate summary'];
    const isTriggered = summaryTriggers.some(trigger => text.includes(trigger)) || /<@[\w]+>/.test(text); // allow @mention

    if (isTriggered) {
      log.bot('summary', 'Manual summary request detected');
      await this.runManualSummary(event.channel, event.ts);
      return true;
    }

    return false;
  }
}

module.exports = SummaryBot;
