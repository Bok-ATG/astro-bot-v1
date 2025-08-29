// main bot entry point - all the pieces come together here

const { App, SocketModeReceiver, ExpressReceiver } = require('@slack/bolt');

// grab all our fancy modules
const log = require('./src/utils/log');
const config = require('./src/config');
const TextbookBot = require('./src/bots/textbook-bot');
const VisionBot = require('./src/bots/vision-bot');
const SummaryBot = require('./src/bots/summary-bot');
const MessageHandlers = require('./src/handlers/message.handlers');
const EventHandlers = require('./src/handlers/event.handlers');
const ActionHandlers = require('./src/handlers/action.handlers');

class AstroQABot {
  constructor() {
    this.validateEnvironment();

    const receiver = this.createReceiver();

    this.slackApp = new App({
      token: config.SLACK_BOT_TOKEN,
      clientId: config.SLACK_CLIENT_ID,
      clientSecret: config.SLACK_CLIENT_SECRET,
      receiver: receiver
    });

    if (!config.IS_SOCKET_MODE) {
      this.addHealthEndpoint(receiver);
    }

    this.initializeBots();
    this.initializeHandlers();
    this.setupEventListeners();
  }

  validateEnvironment() {
    const required = [...config.REQUIRED_ENV_VARS];

    if (config.IS_SOCKET_MODE) {
      required.push(...config.SOCKET_MODE_REQUIRED);
    }

    for (const env of required) {
      if (!process.env[env]) {
        throw new Error(`Missing required environment variable: ${env}`);
      }
    }

    log.info(`Environment validated for ${config.IS_SOCKET_MODE ? 'socket' : 'HTTP'} mode`);
  }

  createReceiver() {
    if (config.IS_SOCKET_MODE) {
      log.info(`Creating SocketModeReceiver`);
      return new SocketModeReceiver({
        appToken: config.SLACK_APP_TOKEN,
      });
    } else {
      log.info(`Creating ExpressReceiver with port: ${config.PORT}`);
      return new ExpressReceiver({
        signingSecret: config.SLACK_SIGNING_SECRET,
        endpoints: '/slack/events',
        port: config.PORT,
        host: config.HOST,
      });
    }
  }

  addHealthEndpoint(receiver) {
    receiver.router.get('/health', async (req, res) => {
      try {
        // Test Slack API connectivity using the bot token
        const authTest = await this.slackApp.client.auth.test();

        res.status(200).json({
          status: 'healthy',
          mode: 'http',
          slack_connected: true,
          bot_id: authTest.bot_id,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          mode: 'http',
          slack_connected: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // wake up the bots
  initializeBots() {
    log.info('Initializing bot modules...');

    this.textbookBot = new TextbookBot();
    this.visionBot = new VisionBot();
    this.summaryBot = new SummaryBot(this.slackApp.client);

    log.success('All bot modules initialized successfully');
  }

  // set up the message routing system
  initializeHandlers() {
    log.info('Initializing handler modules...');

    this.messageHandlers = new MessageHandlers(
      this.textbookBot,
      this.visionBot,
      this.summaryBot,
      this.slackApp.client
    );

    this.eventHandlers = new EventHandlers(
      this.textbookBot,
      this.visionBot,
      this.summaryBot,
      this.slackApp.client
    );

    this.actionHandlers = new ActionHandlers(
      this.textbookBot,
      this.visionBot,
      this.summaryBot,
      this.slackApp.client
    );

    log.success('All handler modules initialized successfully');
  }

  // tell slack what we care about
  setupEventListeners() {
    log.info('Setting up Slack event listeners...');

    this.slackApp.event('message', async ({ event, client }) => {
      await this.messageHandlers.handleMessage(event, client);
    });

    this.slackApp.event('app_mention', async ({ event, client }) => {
      await this.messageHandlers.handleAppMention(event, client);
    });

    this.slackApp.event('reaction_added', async ({ event, client }) => {
      await this.eventHandlers.handleReactionAdded(event, client);
    });

    this.slackApp.event('member_joined_channel', async ({ event, client }) => {
      await this.eventHandlers.handleMemberJoinedChannel(event, client);
    });

    this.slackApp.event('file_shared', async ({ event, client }) => {
      await this.eventHandlers.handleFileShared(event, client);
    });

    this.slackApp.event('team_join', async ({ event, client }) => {
      await this.eventHandlers.handleTeamJoin(event, client);
    });

    this.slackApp.command('/generate-summary', async ({ command, ack, client }) => {
      await this.actionHandlers.handleSlashCommand(command, ack, client);
    });

    this.slackApp.command('/bot-stats', async ({ command, ack, client }) => {
      await this.actionHandlers.handleSlashCommand(command, ack, client);
    });

    this.slackApp.command('/help', async ({ command, ack, client }) => {
      await this.actionHandlers.handleSlashCommand(command, ack, client);
    });

    this.slackApp.action(/.*/, async ({ action, ack, client }) => {
      if (action.type === 'button') {
        await this.actionHandlers.handleButtonClick(action, ack, client);
      } else if (action.type === 'static_select') {
        await this.actionHandlers.handleSelectMenu(action, ack, client);
      }
    });

    log.success('Event listeners configured successfully');
  }

  // fire it up
  async start() {
    try {
      log.separator();
      log.startup('Starting AstroBot...');
      log.info(`Starting in ${config.IS_SOCKET_MODE ? 'socket' : 'HTTP'} mode`);

      if (config.IS_SOCKET_MODE) {
        await this.slackApp.start();
      } else {
        await this.slackApp.start(config.PORT);
        log.info(`HTTP server listening on port: ${config.PORT}`);
      }

      log.success('AstroBot is now live and ready!');
      log.info('Bot capabilities:');
      log.info(`  Text Q&A via OpenAI Assistant: ${config.OPENAI_ASSISTANT_ID}`);
      log.info('  Image question extraction');
      log.info('  Channel activity summaries');
      log.info('  Conversation thread management');

      log.separator();

      // housekeeping - clean up old threads every hour
      setInterval(() => {
        this.textbookBot.cleanupOldThreads();
      }, 60 * 60 * 1000);

    } catch (error) {
      log.error('Failed to start AstroBot', error);
      process.exit(1);
    }
  }

  // shut down nicely when asked
  async shutdown() {
    log.info('Shutting down AstroBot...');

    try {
      await this.slackApp.stop();
      log.success('Bot shutdown completed successfully');
    } catch (error) {
      log.error('Error during shutdown', error);
    }
  }
}

const bot = new AstroQABot();

// handle ctrl+c and other shutdown signals gracefully
process.on('SIGINT', async () => {
  log.info('Received SIGINT, initiating shutdown...');
  await bot.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('Received SIGTERM, initiating-* shutdown...');
  await bot.shutdown();
  process.exit(0);
});

bot.start().catch((error) => {
  log.error('Fatal error starting bot', error);
  process.exit(1);
});
