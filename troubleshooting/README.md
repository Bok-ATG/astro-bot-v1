# Troubleshooting

## Summary of unrelated data structure content

- Set up `test_summary_bot.js` with simple config to instantiate the summary bot
- Comment out the lines with `slackClient.chat.postMessage` from `summary-bot.js` (currently 242-247) to make sure the bot doesn't post to the production channel
- Start the summary bot with `node --inspect-wait test_summary_bot.js` to have it wait for breakpoints
- It does assume that you have your env configured, so match the environment being tested
- Should run on port 229, should attach to debugger and stop at the first breakpoint
- Variables can be inspected in the VS Code debugger when breakpoints are set
- The root cause was identified as the bot outputting unrelated content when the only message it was summarizing was a single "summary please" request.
    - This was found by inspecting the data being passed around as the request was handled, using the above method for debugging.
