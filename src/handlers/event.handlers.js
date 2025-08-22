// handles emoji reactions and user events

const log = require('../utils/log');

class EventHandlers {
  constructor(textbookBot, visionBot, summaryBot, slackClient) {
    this.textbookBot = textbookBot;
    this.visionBot = visionBot;
    this.summaryBot = summaryBot;
    this.slackClient = slackClient;
    this.channelId = process.env.SLACK_CHANNEL_ID;
    
    log.info('emoji reactions and user events ready');
  }

  // someone reacted to a message
  async handleReactionAdded(event, client) {
    try {
      log.slack('Reaction added', { 
        emoji: event.reaction, 
        user: event.user,
        channel: event.item.channel 
      });

      // ignore reactions from other channels
      if (event.item.channel !== this.channelId) {
        log.debug('Reaction in different channel, ignoring');
        return;
      }

      // pencil emoji = summary time
      if (event.reaction === 'pencil' || event.reaction === 'memo' || event.reaction === 'clipboard') {
        log.bot('summary', 'Summary trigger emoji detected');
        
        // grab the original message
        const messageResult = await client.conversations.history({
          channel: event.item.channel,
          latest: event.item.ts,
          limit: 1,
          inclusive: true
        });

        const originalMessage = messageResult.messages[0];
        if (originalMessage) {
          // see if it's actually asking for a summary
          const text = originalMessage.text?.toLowerCase() || '';
          const summaryKeywords = ['summary', 'summarize', 'analyze', 'overview'];
          const hasSummaryKeyword = summaryKeywords.some(keyword => text.includes(keyword));

          if (hasSummaryKeyword) {
            log.info('Pencil emoji + summary keyword detected - generating summary');
            
            await client.chat.postMessage({
              channel: event.item.channel,
              thread_ts: event.item.ts,
              text: "📝 Pencil reaction detected! Generating channel summary..."
            });

            await this.summaryBot.generateAndPostSummary();
            return;
          }
        }
      }

      // check for other reaction types
      await this.handleOtherReactions(event, client);
      
    } catch (error) {
      log.error('Error handling reaction', error);
    }
  }

  // future reaction handlers
  async handleOtherReactions(event, client) {
    const reactionHandlers = {
      'question': () => this.handleQuestionReaction(event, client),
      'heavy_check_mark': () => this.handleCheckmarkReaction(event, client),
      'x': () => this.handleXReaction(event, client),
      'eyes': () => this.handleEyesReaction(event, client)
    };

    const handler = reactionHandlers[event.reaction];
    if (handler) {
      log.debug(`Handling ${event.reaction} reaction`);
      await handler();
    }
  }

  // question mark reactions (future feature)
  async handleQuestionReaction(event, client) {
    log.info('Question reaction detected - potential re-analysis request');
    // could re-analyze messages later
  }

  // checkmark reactions (future feature)
  async handleCheckmarkReaction(event, client) {
    log.info('Checkmark reaction detected - marking as resolved');
    // could mark as resolved later
  }

  // x reactions (future feature)
  async handleXReaction(event, client) {
    log.info('X reaction detected - potential correction needed');
    // could flag for correction later
  }

  // eyes reactions (future feature)
  async handleEyesReaction(event, client) {
    log.info('Eyes reaction detected - marking as under review');
    // could indicate review status later
  }

  // someone joined the channel
  async handleMemberJoinedChannel(event, client) {
    try {
      log.slack('User joined channel', { user: event.user, channel: event.channel });

      if (event.channel === this.channelId) {
        // welcome the newbie
        await client.chat.postMessage({
          channel: event.channel,
          text: `👋 Welcome! I'm here to help with your questions. You can:
• Ask questions directly in text
• Upload images with questions for analysis
• Request channel summaries with "summary please"
• Use 📝 emoji reactions on summary requests`
        });
      }
    } catch (error) {
      log.error('Error handling member joined event', error);
    }
  }

  // file sharing events
  async handleFileShared(event, client) {
    try {
      log.slack('File shared', { 
        fileId: event.file_id, 
        userId: event.user_id 
      });

      // we handle files through message events instead
      log.debug('File shared event logged - processing handled by message events');
    } catch (error) {
      log.error('Error handling file shared event', error);
    }
  }

  // new team member joined workspace
  async handleTeamJoin(event, client) {
    try {
      log.slack('New team member', { user: event.user.id, name: event.user.name });
      
      // could send welcome dm later
      log.info(`New team member joined: ${event.user.name || event.user.id}`);
    } catch (error) {
      log.error('Error handling team join event', error);
    }
  }

  // slack url verification
  handleUrlVerification(event) {
    log.info('Slack URL verification requested');
    return event.challenge;
  }

  // stats
  getStats() {
    return {
      handlersActive: true,
      supportedEvents: [
        'reaction_added',
        'member_joined_channel',
        'file_shared',
        'team_join'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = EventHandlers;
