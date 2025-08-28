// handles slash commands and button clicks

const log = require('../utils/log');
const config = require('../config');

class ActionHandlers {
  constructor(textbookBot, visionBot, summaryBot, slackClient) {
    this.textbookBot = textbookBot;
    this.visionBot = visionBot;
    this.summaryBot = summaryBot;
    this.slackClient = slackClient;
    this.channelId = config.SLACK_CHANNEL_ID;

    log.info('slash commands and buttons ready to go');
  }

  // main slash command router
  async handleSlashCommand(command, ack, client) {
    try {
      await ack();

      log.slack('Slash command received', {
        command: command.command,
        user: command.user_name,
        channel: command.channel_name
      });

      switch (command.command) {
        case '/generate-summary':
          await this.handleGenerateSummaryCommand(command, client);
          break;

        case '/bot-stats':
          await this.handleBotStatsCommand(command, client);
          break;

        case '/help':
          await this.handleHelpCommand(command, client);
          break;

        default:
          log.warning(`Unknown slash command: ${command.command}`);
          await this.handleUnknownCommand(command, client);
      }
    } catch (error) {
      log.error('Error handling slash command', error);

      try {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: "Sorry, I encountered an error processing your command. Please try again."
        });
      } catch (responseError) {
        log.error('Failed to send error response for slash command', responseError);
      }
    }
  }

  async handleGenerateSummaryCommand(command, client) {
    log.bot('summary', 'Manual summary generation requested via slash command');

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: "🔄 Generating channel summary. This may take a moment..."
    });

    await this.summaryBot.generateAndPostSummary();

    log.success('Summary generation completed via slash command');
  }

  async handleBotStatsCommand(command, client) {
    log.info('Bot statistics requested');

    try {
      const textbookStats = this.textbookBot.getThreadStats();
      const currentTime = new Date().toISOString();

      const statsMessage = `📊 *Bot Statistics*\n\n` +
        `*Active Conversations:* ${textbookStats.activeThreads}\n` +
        `*Textbook Bot:* Ready ✅\n` +
        `*Vision Bot:* Ready ✅\n` +
        `*Summary Bot:* Ready ✅\n\n` +
        `*Last Updated:* ${currentTime}`;

      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: statsMessage
      });
    } catch (error) {
      log.error('Error generating bot statistics', error);
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: "Error retrieving bot statistics. Please try again."
      });
    }
  }

  async handleHelpCommand(command, client) {
    log.info('Help information requested');

    const helpMessage = `🤖 *AstroBot Help*\n\n` +
      `*How to use me:*\n` +
      `• Ask questions directly in text\n` +
      `• Upload images with questions for analysis\n` +
      `• Request summaries with "summary please"\n` +
      `• Use 📝 emoji on summary requests\n\n` +
      `*Available Commands:*\n` +
      `• \`/generate-summary\` - Generate channel analysis\n` +
      `• \`/bot-stats\` - View bot statistics\n` +
      `• \`/help\` - Show this help message\n\n` +
      `*Features:*\n` +
      `• Text Q&A via OpenAI Assistant\n` +
      `• Image question extraction\n` +
      `• Channel activity summaries\n` +
      `• Conversation thread management`;

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: helpMessage
    });
  }

  async handleUnknownCommand(command, client) {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: `Unknown command: \`${command.command}\`\n\nUse \`/help\` to see available commands.`
    });
  }

  // someone clicked a button
  async handleButtonClick(action, ack, client) {
    try {
      await ack();

      log.slack('Button interaction', {
        actionId: action.action_id,
        user: action.user.id,
        value: action.value
      });

      switch (action.action_id) {
        case 'regenerate_summary':
          await this.handleRegenerateSummary(action, client);
          break;

        case 'clear_threads':
          await this.handleClearThreads(action, client);
          break;

        default:
          log.warning(`Unknown button action: ${action.action_id}`);
      }
    } catch (error) {
      log.error('Error handling button click', error);
    }
  }

  async handleRegenerateSummary(action, client) {
    log.bot('summary', 'Summary regeneration requested via button');

    await client.chat.postEphemeral({
      channel: action.channel.id,
      user: action.user.id,
      text: "🔄 Regenerating summary..."
    });

    await this.summaryBot.generateAndPostSummary();
  }

  async handleClearThreads(action, client) {
    log.info('Thread cleanup requested via button');

    const cleaned = this.textbookBot.cleanupOldThreads();

    await client.chat.postEphemeral({
      channel: action.channel.id,
      user: action.user.id,
      text: `🧹 Cleaned up ${cleaned} old conversation threads.`
    });
  }

  // dropdown menu selections
  async handleSelectMenu(action, ack, client) {
    try {
      await ack();

      log.slack('Select menu interaction', {
        actionId: action.action_id,
        selectedOption: action.selected_option?.value
      });

      switch (action.action_id) {
        case 'summary_timeframe':
          await this.handleTimeframeSelection(action, client);
          break;

        default:
          log.warning(`Unknown select menu action: ${action.action_id}`);
      }
    } catch (error) {
      log.error('Error handling select menu', error);
    }
  }

  async handleTimeframeSelection(action, client) {
    const timeframe = action.selected_option.value;
    const hours = parseInt(timeframe);

    log.bot('summary', `Custom timeframe selected: ${hours} hours`);

    // temp override the timeframe
    const originalHours = this.summaryBot.messageHistoryHours;
    this.summaryBot.messageHistoryHours = hours;

    await client.chat.postEphemeral({
      channel: action.channel.id,
      user: action.user.id,
      text: `🔄 Generating summary for last ${hours} hours...`
    });

    await this.summaryBot.generateAndPostSummary();

    // put it back
    this.summaryBot.messageHistoryHours = originalHours;
  }

  // stats for nerds
  getStats() {
    return {
      supportedCommands: [
        '/generate-summary',
        '/bot-stats',
        '/help'
      ],
      supportedActions: [
        'regenerate_summary',
        'clear_threads',
        'summary_timeframe'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ActionHandlers;
