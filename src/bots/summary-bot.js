// the analyzer - watches conversations and makes sense of them

const { OpenAI } = require('openai');
const cron = require('node-cron');
const log = require('../utils/log');
const config = require('../config');

class SummaryBot {
  constructor(slackClient) {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
    this.slackClient = slackClient;
    this.channelId = config.SLACK_CHANNEL_ID;
    this.messageHistoryHours = config.MESSAGE_HISTORY_HOURS;
    this.summarySchedule = config.SUMMARY_SCHEDULE;

    this.setupScheduledSummaries();
    log.bot('summary', 'ready to stalk your conversations (for science)');
  }

  // dig through chat history
  async fetchChannelHistory(hoursAgo = this.messageHistoryHours) {
    try {
      const now = new Date();
      const oldest = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

      log.bot('summary', `Fetching ${hoursAgo} hours of conversation history`);
      log.debug('Time range', {
        from: oldest.toISOString(),
        to: now.toISOString()
      });

      // Initial fetch
      const result = await this.slackClient.conversations.history({
        channel: this.channelId,
        oldest: (oldest.getTime() / 1000).toString(),
        limit: 100,
      });

      let messages = result.messages || [];
      let cursor = result.response_metadata?.next_cursor;

      // keep grabbing more messages if there are any
      while (cursor) {
        log.debug('Fetching additional message page');
        const nextPage = await this.slackClient.conversations.history({
          channel: this.channelId,
          cursor,
          limit: 100,
        });

        messages = messages.concat(nextPage.messages || []);
        cursor = nextPage.response_metadata?.next_cursor;
      }

      // clean up and sort the messages
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

  // turn user ids into actual names (much more friendly)
  async enrichMessagesWithUserInfo(messages) {
    try {
      const userCache = new Map();
      log.bot('summary', 'Enriching messages with user information');

      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        if (!msg.user) return msg;

        // see if we already know this user
        if (!userCache.has(msg.user)) {
          try {
            const userInfo = await this.slackClient.users.info({ user: msg.user });
            const userName = userInfo.user.real_name || userInfo.user.name || msg.user;
            userCache.set(msg.user, userName);
          } catch (error) {
            log.warning(`Could not fetch info for user ${msg.user}`, error.message);
            userCache.set(msg.user, msg.user); // Use ID as fallback
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

  // let the ai make sense of all this chatter
  async generateSummaryAndQuestions(messages) {
    if (messages.length === 0) {
      return {
        summary: "No activity detected in the channel during this period.",
        questions: [],
        concept_trends: [],
        metacognitive_insights: "",
        unresolved_issues: []
      };
    }

    try {
      log.openai('Generating conversation analysis and insights');

      // prep the messages for ai analysis
      const formattedMessages = messages.map(msg =>
        `[${msg.timestamp}] ${msg.userName}: ${msg.text}`
      ).join('\n\n');

      const systemPrompt = `
        FUNCTION
        Analyze educational Slack channel conversation data. Extract patterns in student questions and conceptual difficulties.
        Maintain academic precision. Avoid conversational language. Focus on technical analysis of learning patterns.

        OUTPUT REQUIREMENTS
        1. Produce a concise summary (max 300 words) of key topics and discussions
        2. Identify specific patterns in student questions with precise categorization
        3. Analyze cognitive barriers and conceptual obstacles based on evidence in the conversation
        4. Formulate 3-5 targeted questions that address core conceptual challenges
        5. Document unresolved technical issues from the conversation

        RESPONSE PROTOCOL
        - Eliminate subjective assessments
        - Focus on observable patterns in the data
        - Cite specific examples from the conversation when possible
        - Maintain technical precision in all analyses
        - Avoid speculative content where data is insufficient

        Format response as JSON with the following structure:
        {
          "summary": "Technical summary of key topics and discussions",
          "concept_trends": ["Trend 1: Specific description with evidence", "Trend 2: Specific description with evidence"],
          "metacognitive_insights": "Analysis of cognitive barriers and conceptual obstacles",
          "questions": ["Targeted question 1", "Targeted question 2", "Targeted question 3"],
          "unresolved_issues": ["Unresolved issue 1", "Unresolved issue 2"]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the conversation history from the last ${this.messageHistoryHours} hours:\n\n${formattedMessages}` }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content);

      log.success('Analysis completed successfully');
      return {
        summary: result.summary || "No summary generated.",
        questions: result.questions || [],
        unresolved_issues: result.unresolved_issues || [],
        concept_trends: result.concept_trends || [],
        metacognitive_insights: result.metacognitive_insights || ""
      };
    } catch (error) {
      log.error('Failed to generate summary and analysis', error);
      return {
        summary: "Error generating summary.",
        questions: [],
        unresolved_issues: [],
        concept_trends: [],
        metacognitive_insights: ""
      };
    }
  }

  // make it pretty for slack
  formatSlackMessage(data) {
    const { summary, questions, unresolved_issues, concept_trends, metacognitive_insights } = data;

    let message = `*Channel Activity Analysis (Last ${this.messageHistoryHours} Hours)*\n\n`;

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

  // analyze and post
  async generateAndPostSummary() {
    try {
      log.bot('summary', 'Starting comprehensive channel analysis');

      const messages = await this.fetchChannelHistory();
      if (messages.length === 0) {
        log.info('No messages found in specified time period');
        return;
      }

      const enrichedMessages = await this.enrichMessagesWithUserInfo(messages);
      const summaryData = await this.generateSummaryAndQuestions(enrichedMessages);
      const formattedMessage = this.formatSlackMessage(summaryData);

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

  // set up automatic summaries
  setupScheduledSummaries() {
    if (this.summarySchedule) {
      cron.schedule(this.summarySchedule, async () => {
        log.info('Scheduled summary generation triggered');
        await this.generateAndPostSummary();
      });
      log.info(`Scheduled summaries configured: ${this.summarySchedule}`);
    }
  }

  // check if someone's asking for a summary
  async handleSummaryRequest(event) {
    const text = event.text?.toLowerCase() || '';
    const summaryTriggers = ['summary please', 'summarize channel', 'channel summary', 'generate summary'];

    const isTriggered = summaryTriggers.some(trigger => text.includes(trigger));

    if (isTriggered) {
      log.bot('summary', 'Manual summary request detected');

      // let them know we're on it
      await this.slackClient.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: "🔄 Initiating channel analysis. Processing conversation history..."
      });

      // Generate summary
      await this.generateAndPostSummary();
      return true;
    }

    return false;
  }
}

module.exports = SummaryBot;
