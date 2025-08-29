// the one that answers questions

const { OpenAI } = require('openai');
const log = require('../utils/log');
const config = require('../config');

class TextbookBot {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
    this.assistantId = config.OPENAI_ASSISTANT_ID;
    this.threadMap = new Map(); // Slack thread_ts <-> OpenAI thread_id

    log.bot('textbook', 'ready to answer all your burning questions');
  }

  // keep track of conversations (data data data)
  async getOrCreateThread(slackThreadTs) {
    try {
      if (this.threadMap.has(slackThreadTs)) {
        const threadId = this.threadMap.get(slackThreadTs);
        log.debug(`Using existing thread for conversation ${slackThreadTs}`, { threadId });
        return threadId;
      }

      log.openai('Creating new conversation thread');
      const thread = await this.openai.beta.threads.create();
      this.threadMap.set(slackThreadTs, thread.id);

      log.success(`New conversation thread established`, {
        slackThread: slackThreadTs,
        openaiThread: thread.id
      });

      return thread.id;
    } catch (error) {
      log.error('Failed to create or retrieve conversation thread', error);
      throw error;
    }
  }

  //  ask a question, get an answer
  async processQuestion(question, slackThreadTs) {
    try {
      log.bot('textbook', `Processing question from thread ${slackThreadTs}`);
      log.debug('Question content', { question: question.substring(0, 100) + '...' });

      const openaiThreadId = await this.getOrCreateThread(slackThreadTs);

      // Add user message to thread
      log.openai('Adding user message to conversation thread');
      await this.openai.beta.threads.messages.create(openaiThreadId, {
        role: 'user',
        content: question,
      });

      // Create and monitor run
      log.openai('Starting assistant analysis');
      const run = await this.openai.beta.threads.runs.create(openaiThreadId, {
        assistant_id: this.assistantId,
      });

      // wait for the ai to think (and give updates so we don't look dead)
      let runStatus;
      let attempts = 0;
      const maxAttempts = 40; // 60 seconds max wait time

      do {
        await new Promise(resolve => setTimeout(resolve, 1500));
        runStatus = await this.openai.beta.threads.runs.retrieve(openaiThreadId, run.id);
        attempts++;

        if (attempts % 5 === 0) {
          log.info(`still thinking... (${attempts * 1.5}s elapsed)`);
        }

        if (attempts >= maxAttempts) {
          log.warning('Assistant taking longer than expected, but continuing...');
          break;
        }
      } while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && runStatus.status !== 'cancelled');

      if (runStatus.status === 'completed') {
        log.success('Assistant analysis completed');

        const messages = await this.openai.beta.threads.messages.list(openaiThreadId, {
          limit: 1,
          order: 'desc'
        });

        const assistantReply = messages.data[0]?.content[0]?.text?.value ||
                              "sorry, my brain broke trying to answer that";

        log.bot('textbook', 'Generated response ready for delivery');
        return assistantReply;
      } else {
        log.error(`Assistant run failed with status: ${runStatus.status}`);
        return "something went wrong on my end, try asking again?";
      }
    } catch (error) {
      log.error('Error processing question through textbook bot', error);
      return "oops, something broke. try again?";
    }
  }

  // how many conversations are we juggling?
  getThreadStats() {
    return {
      activeThreads: this.threadMap.size,
      threads: Array.from(this.threadMap.keys())
    };
  }

  // spring cleaning for old conversations
  cleanupOldThreads(maxAge = 24 * 60 * 60 * 1000) { // dump anything older than a day
    const now = Date.now();
    let cleaned = 0;

    for (const [slackThreadTs, openaiThreadId] of this.threadMap.entries()) {
      const threadAge = now - (parseFloat(slackThreadTs) * 1000);
      if (threadAge > maxAge) {
        this.threadMap.delete(slackThreadTs);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info(`cleaned up ${cleaned} old threads (marie kondo would be proud)`);
    }

    return cleaned;
  }
}

module.exports = TextbookBot;
