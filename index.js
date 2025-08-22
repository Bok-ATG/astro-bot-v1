// main bot entry point - all the pieces come together here

require('dotenv').config();
const { App } = require('@slack/bolt');

// grab all our fancy modules
const log = require('./src/utils/log');
const TextbookBot = require('./src/bots/textbook-bot');
const VisionBot = require('./src/bots/vision-bot');
const SummaryBot = require('./src/bots/summary-bot');
const MessageHandlers = require('./src/handlers/message.handlers');
const EventHandlers = require('./src/handlers/event.handlers');
const ActionHandlers = require('./src/handlers/action.handlers');

class AstroQABot {
  constructor() {
    this.slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN,
    });
    
    this.initializeBots();
    this.initializeHandlers();
    this.setupEventListeners();
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
      log.startup('Starting Astro QA Bot...');
      
      await this.slackApp.start();
      
      log.success('Astro QA Bot is now live and ready!');
      log.info('Bot capabilities:');
      log.info('  Text Q&A via OpenAI Assistant');
      log.info('  Image question extraction');
      log.info('  Channel activity summaries');
      log.info('  Conversation thread management');
      log.separator();
      
      // housekeeping - clean up old threads every hour
      setInterval(() => {
        this.textbookBot.cleanupOldThreads();
      }, 60 * 60 * 1000);
      
    } catch (error) {
      log.error('Failed to start Astro QA Bot', error);
      process.exit(1);
    }
  }

  // shut down nicely when asked
  async shutdown() {
    log.info('Shutting down Astro QA Bot...');
    
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
