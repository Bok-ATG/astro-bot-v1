require('dotenv').config({ path: '../.env' });

const { App, SocketModeReceiver } = require('@slack/bolt');
const config = require('../src/config');
const SummaryBot = require('../src/bots/summary-bot');

const slackApp = new App({
    token: config.SLACK_BOT_TOKEN,
    clientId: config.SLACK_CLIENT_ID,
    clientSecret: config.SLACK_CLIENT_SECRET,
    receiver: new SocketModeReceiver({
        appToken: config.SLACK_APP_TOKEN,
    })
});

// Mock chat.postMessage to log to console
// so that it doesn't actually post to slack
slackApp.client.chat.postMessage = async (data) => {
    console.log('Mock postMessage called with:', data);
    return { ok: true };
};

const summaryBot = new SummaryBot(slackApp.client);

summaryBot.generateAndPostSummary();