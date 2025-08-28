// centralized environment configuration

require('dotenv').config();

// Slack Configuration
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN;
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const SLACK_MODE = process.env.SLACK_MODE || 'socket';

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

// Server Configuration
const PORT = parseInt(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Bot Behavior Configuration
const MESSAGE_HISTORY_HOURS = parseInt(process.env.MESSAGE_HISTORY_HOURS) || 24;
const SUMMARY_SCHEDULE = process.env.SUMMARY_SCHEDULE || '0 18 * * 1-5'; // 6 PM Monday-Friday

// Development/Debug Configuration
const NODE_ENV = process.env.NODE_ENV;
const DEBUG = process.env.DEBUG === 'true';
const JSON_LOGS = process.env.JSON_LOGS === 'true';

// Derived configurations
const IS_SOCKET_MODE = SLACK_MODE !== 'http';

// Required environment variables for validation
const REQUIRED_ENV_VARS = [
  'SLACK_BOT_TOKEN',
  'SLACK_USER_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_CHANNEL_ID',
  'OPENAI_API_KEY',
  'OPENAI_ASSISTANT_ID',
];

// Additional required vars for socket mode
const SOCKET_MODE_REQUIRED = ['SLACK_APP_TOKEN'];

module.exports = {
  // Slack
  SLACK_BOT_TOKEN,
  SLACK_USER_TOKEN,
  SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  SLACK_CHANNEL_ID,
  SLACK_MODE,

  // OpenAI
  OPENAI_API_KEY,
  OPENAI_ASSISTANT_ID,

  // Server
  PORT,
  HOST,

  // Bot behavior
  MESSAGE_HISTORY_HOURS,
  SUMMARY_SCHEDULE,

  // Development
  NODE_ENV,
  DEBUG,
  JSON_LOGS,

  // Derived
  IS_SOCKET_MODE,

  // Validation
  REQUIRED_ENV_VARS,
  SOCKET_MODE_REQUIRED,
};
