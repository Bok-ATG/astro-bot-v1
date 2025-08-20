require('dotenv').config();
const { App } = require('@slack/bolt');
const { OpenAI } = require('openai');

console.log('SLACK_SIGNING_SECRET_DEV:', process.env.SLACK_SIGNING_SECRET_DEV);
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

// Store thread mapping (Slack thread_ts <-> OpenAI thread_id)
const threadMap = new Map();

async function getOrCreateOpenAIThread(slackThreadTs) {
  if (threadMap.has(slackThreadTs)) {
    return threadMap.get(slackThreadTs);
  }
  const thread = await openai.beta.threads.create();
  threadMap.set(slackThreadTs, thread.id);
  return thread.id;
}

slackApp.event('message', async ({ event, client }) => {
  try {
    // Only respond in the specified channel
    if (event.channel !== SLACK_CHANNEL_ID) return;
    // Ignore bot messages
    if (event.subtype === 'bot_message' || event.bot_id) return;

    const slackThreadTs = event.thread_ts || event.ts;

    // If the message contains files (e.g., images)
    if (event.files && event.files.length > 0) {
      for (const file of event.files) {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
          // Download the image (requires Slack user token)
          const imageUrl = file.url_private;
          const axios = require('axios');
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: { Authorization: `Bearer ${process.env.SLACK_USER_TOKEN}` },
          });
          const imageBuffer = Buffer.from(imageResponse.data, 'binary');

          // Send image to OpenAI Vision model for text extraction
          const visionResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Extract any questions from this image. If there is a question, return only the question text. If not, reply: NO_QUESTION_FOUND.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`,
                      detail: 'auto'
                    }
                  }
                ]
              }
            ],
            max_tokens: 1000
          });

          const visionText = visionResponse.choices[0]?.message?.content?.trim();
          if (visionText && visionText !== 'NO_QUESTION_FOUND') {
            // Process as a normal user message
            const openaiThreadId = await getOrCreateOpenAIThread(slackThreadTs);
            await openai.beta.threads.messages.create(openaiThreadId, {
              role: 'user',
              content: visionText,
            });
            const run = await openai.beta.threads.runs.create(openaiThreadId, {
              assistant_id: ASSISTANT_ID,
            });
            let runStatus;
            do {
              await new Promise(res => setTimeout(res, 1500));
              runStatus = await openai.beta.threads.runs.retrieve(openaiThreadId, run.id);
            } while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && runStatus.status !== 'cancelled');
            if (runStatus.status === 'completed') {
              const messages = await openai.beta.threads.messages.list(openaiThreadId, { limit: 1, order: 'desc' });
              const assistantReply = messages.data[0]?.content[0]?.text?.value || "Sorry, I couldn't generate a reply.";
              await client.chat.postMessage({
                channel: event.channel,
                thread_ts: slackThreadTs,
                text: assistantReply,
              });
            } else {
              await client.chat.postMessage({
                channel: event.channel,
                thread_ts: slackThreadTs,
                text: "Sorry, I couldn't generate a reply (run failed).",
              });
            }
            return;
          }
        }
      }
    }

    // If the message is plain text
    if (event.text && event.text.trim().length > 0) {
      const userMessage = event.text;
      const openaiThreadId = await getOrCreateOpenAIThread(slackThreadTs);
      await openai.beta.threads.messages.create(openaiThreadId, {
        role: 'user',
        content: userMessage,
      });
      const run = await openai.beta.threads.runs.create(openaiThreadId, {
        assistant_id: ASSISTANT_ID,
      });
      let runStatus;
      do {
        await new Promise(res => setTimeout(res, 1500));
        runStatus = await openai.beta.threads.runs.retrieve(openaiThreadId, run.id);
      } while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && runStatus.status !== 'cancelled');
      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(openaiThreadId, { limit: 1, order: 'desc' });
        const assistantReply = messages.data[0]?.content[0]?.text?.value || "Sorry, I couldn't generate a reply.";
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: slackThreadTs,
          text: assistantReply,
        });
      } else {
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: slackThreadTs,
          text: "Sorry, I couldn't generate a reply (run failed).",
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
});

(async () => {
  await slackApp.start();
  console.log('⚡️ Slack OpenAI Assistant bot is running (socket mode)!');
})();
