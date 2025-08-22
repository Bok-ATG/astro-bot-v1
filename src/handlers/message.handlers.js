// traffic controller for incoming messages

const log = require('../utils/log');

class MessageHandlers {
  constructor(textbookBot, visionBot, summaryBot, slackClient) {
    this.textbookBot = textbookBot;
    this.visionBot = visionBot;
    this.summaryBot = summaryBot;
    this.slackClient = slackClient;
    this.channelId = process.env.SLACK_CHANNEL_ID;
    
    log.info('message routing system online');
  }

  // main message dispatcher
  async handleMessage(event, client) {
    try {
      log.slack('Incoming message received', { 
        channel: event.channel,
        user: event.user,
        hasFiles: !!(event.files && event.files.length > 0),
        hasText: !!(event.text && event.text.trim().length > 0)
      });

      // ignore messages from other channels
      if (event.channel !== this.channelId) {
        log.debug('Message from different channel, ignoring');
        return;
      }

      // ignore bot messages to avoid infinite loops
      if (event.subtype === 'bot_message' || event.bot_id) {
        log.debug('Bot message detected, ignoring to prevent loops');
        return;
      }

      const slackThreadTs = event.thread_ts || event.ts;

      // see if they want a summary
      const summaryHandled = await this.summaryBot.handleSummaryRequest(event);
      if (summaryHandled) {
        log.info('Message routed to summary bot');
        return;
      }

      // they uploaded something
      if (event.files && event.files.length > 0) {
        await this.handleFilesMessage(event, client, slackThreadTs);
        return;
      }

      // plain text question
      if (event.text && event.text.trim().length > 0) {
        await this.handleTextMessage(event, client, slackThreadTs);
        return;
      }

      log.debug('Message contained no processable content');
    } catch (error) {
      log.error('Error in message handler', error);
      
      // tell user something broke
      try {
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts || event.ts,
          text: "I encountered an error processing your message. Please try again."
        });
      } catch (responseError) {
        log.error('Failed to send error response', responseError);
      }
    }
  }

  // handle image uploads
  async handleFilesMessage(event, client, slackThreadTs) {
    log.info('Processing message with attached files');
    
    const imageFiles = event.files.filter(file => 
      this.visionBot.isProcessableImage(file)
    );

    if (imageFiles.length === 0) {
      log.info('No processable images found in uploaded files');
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: slackThreadTs,
        text: "I can only process image files. Please upload an image with your question."
      });
      return;
    }

    // let them know we're working on it
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: slackThreadTs,
      text: `🔍 Analyzing ${imageFiles.length} image(s) for questions...`
    });

    try {
      // send to vision bot for analysis
      const visionResults = await this.visionBot.processMultipleImages(imageFiles);
      const successfulExtractions = visionResults.filter(result => result.success && result.text);

      if (successfulExtractions.length === 0) {
        log.info('No questions found in any uploaded images');
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: slackThreadTs,
          text: "I couldn't find any questions in the uploaded image(s). Please make sure your image contains clear, readable text with questions."
        });
        return;
      }

      // now send questions to textbook bot
      for (const extraction of successfulExtractions) {
        log.info(`Processing extracted question from ${extraction.filename}`);
        
        const response = await this.textbookBot.processQuestion(extraction.text, slackThreadTs);
        
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: slackThreadTs,
          text: `📚 *Question from ${extraction.filename}:*\n\n${response}`
        });
      }

      log.success(`Successfully processed ${successfulExtractions.length} image question(s)`);
    } catch (error) {
      log.error('Error processing image files', error);
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: slackThreadTs,
        text: "I had trouble processing your image. Please try uploading it again or ask your question as text."
      });
    }
  }

  // handle regular text questions
  async handleTextMessage(event, client, slackThreadTs) {
    const userMessage = event.text.trim();
    log.info('Processing text question');

    try {
      // show we're thinking
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: slackThreadTs,
        text: "🤔 Thinking about your question..."
      });

      // send to textbook bot
      const response = await this.textbookBot.processQuestion(userMessage, slackThreadTs);
      
      // replace thinking message with answer
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: slackThreadTs,
        text: response
      });

      log.success('Text question processed and response delivered');
    } catch (error) {
      log.error('Error processing text message', error);
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: slackThreadTs,
        text: "I encountered an error processing your question. Please try rephrasing or ask again."
      });
    }
  }

  // someone @mentioned us
  async handleAppMention(event, client) {
    try {
      log.slack('App mention received', { user: event.user, channel: event.channel });

      // see if they want a summary
      if (event.text.toLowerCase().includes('generate summary')) {
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: "🔄 Generating channel activity analysis. Processing conversation history..."
        });

        await this.summaryBot.generateAndPostSummary();
        return;
      }

      // treat it like a normal question
      const questionText = event.text.replace(/<@[^>]+>/g, '').trim();
      if (questionText.length > 0) {
        await this.handleTextMessage({
          ...event,
          text: questionText
        }, client, event.ts);
      } else {
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: "Hi! I'm here to help with your questions. You can:\n• Ask me questions directly\n• Upload images with questions\n• Request a channel summary"
        });
      }
    } catch (error) {
      log.error('Error handling app mention', error);
    }
  }

  // stats
  getStats() {
    return {
      textbookThreads: this.textbookBot.getThreadStats(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = MessageHandlers;
