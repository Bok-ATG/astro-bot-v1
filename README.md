# AstroBot

A Slack bot that integrates with OpenAI's Assistants API to answer student questions using textbook documents. Designed for use in public channels where students can ask questions and see responses.

## Overview

AstroBot is a Slack application that uses OpenAI's Assistants API to respond to messages and events. The bot has three main components:

- **Textbook Bot**: Answers questions based on uploaded documents
- **Vision Bot**: Analyzes and describes images shared in channels
- **Summary Bot**: Generates summaries of channel activity
- **Slash Commands**:
  - `/generate-summary` - Posts a summary of recent activity
  - `/bot-stats` - Shows stats about the bot’s activity
  - `/help` - Provides a help message listing

The bot supports two connection modes:
- **Socket Mode**: For local development (default)
- **HTTP Mode**: For containerized/production deployments

## Quickstart

### Prerequisites
- Node.js (v20 or higher)
- Docker (optional, for containerized deployment)
- OpenAI API account with Assistants API access
- Slack workspace with admin permissions to install apps

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd astro-bot-v1
   ```

2. **Configure environment variables**
   ```bash
   cp .env.sample .env
   ```
   Edit the `.env` file with your actual values (see *Environment Variables* section below).

3. **Choose your deployment method:**

   **Option A: Local Development (Socket Mode)**
   ```bash
   npm install
   npm start
   ```

   **Option B: Docker (HTTP Mode)**
   ```bash
   # Use HTTP mode configuration
   cp .env.http.sample .env
   # Edit .env with your values, then:
   docker compose up
   ```

## Environment Variables

Create a `.env` file based on `.env.sample` with the following variables:

| Variable                | Description                            | Required                   | Mode      |
|-------------------------|----------------------------------------|----------------------------|-----------|
| `SLACK_CLIENT_ID`       | Slack app client ID                    | Yes                        | Both      |
| `SLACK_CLIENT_SECRET`   | Slack app client secret                | Yes                        | Both      |
| `SLACK_SIGNING_SECRET`  | Used to verify requests from Slack     | Yes                        | Both      |
| `SLACK_BOT_TOKEN`       | Bot user OAuth token                   | Yes                        | Both      |
| `SLACK_APP_TOKEN`       | App-level token for Socket Mode        | Socket only                | Socket    |
| `SLACK_USER_TOKEN`      | User OAuth token for file access       | Yes                        | Both      |
| `OPENAI_API_KEY`        | OpenAI API secret key                  | Yes                        | Both      |
| `OPENAI_ASSISTANT_ID`   | ID of your OpenAI Assistant            | Yes                        | Both      |
| `SLACK_CHANNEL_ID`      | Default channel for bot operations     | Yes                        | Both      |
| `SLACK_MODE`            | Connection mode: `socket` or `http`    | No (default: socket)       | Both      |
| `HOST`                  | Host address for HTTP mode             | No (default: 0.0.0.0)      | HTTP only |
| `PORT`                  | Port for HTTP mode                     | No (default: 3000)         | HTTP only |
| `MESSAGE_HISTORY_HOURS` | Hours of message history for summaries | No (default: 24)           | Both      |
| `SUMMARY_SCHEDULE`      | Cron schedule for automated summaries  | No (default: 6 PM Mon-Fri) | Both      |
| `ASTROBOT_DEBUG`        | Enable debug logging                   | No (default: false)        | Both      |
| `JSON_LOGS`             | Output logs in JSON format             | No (default: false)        | Both      |


### Connection Modes

**Socket Mode (Default)**
- Use for local development
- No public HTTP endpoint needed
- Requires `SLACK_APP_TOKEN`

**HTTP Mode**
- Use for production/containerized deployments
- Requires public HTTP endpoint for webhooks
- Health check endpoint available at `/health`
- More suitable for load balancing and scaling

## Slack Setup

### Creating a New Slack App

1. **Navigate to Slack API**
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App"

2. **Use App Manifest**
   - Select "From an app manifest"
   - Choose your workspace
   - Copy the contents of `slack_app_manifest.yml` from this repository
   - Paste the manifest and review the configuration

3. **Get Basic App Credentials**
   - Navigate to "Basic Information" in the sidebar
   - Under "App Credentials", copy the following:
     - **Client ID** (`SLACK_CLIENT_ID`)
     - **Client Secret** (`SLACK_CLIENT_SECRET`)
     - **Signing Secret** (`SLACK_SIGNING_SECRET`)

4. **Generate App-Level Token (Socket Mode Only)**
   - **Note**: This step is only required if you plan to use Socket Mode for local development
   - Still in "Basic Information", scroll down to "App-Level Tokens"
   - Click "Generate Token and Scopes"
   - Add the `connections:write` scope
   - Generate the token and copy it (starts with `xapp-`) - this is your `SLACK_APP_TOKEN`

5. **Install to Workspace and Get OAuth Tokens**
   - Navigate to "Install App" in the sidebar
   - Click "Install to Workspace"
   - Authorize the required permissions
   - After installation, navigate to "OAuth & Permissions" in the sidebar
   - Copy both tokens from this page:
     - **Bot User OAuth Token** (starts with `xoxb-`) - this is your `SLACK_BOT_TOKEN`
     - **User OAuth Token** (starts with `xoxp-`) - this is your `SLACK_USER_TOKEN`
   - **Note**: The bot token is used for sending messages and basic bot operations, while the user token is required for file access operations. Both are needed for the app to function properly.

### Additional Setup for HTTP Mode

If you plan to use HTTP mode for production deployment:

1. **Configure Event Subscriptions**
   - Navigate to "Event Subscriptions" in the sidebar
   - Enable Events and set your Request URL to: `https://your-domain.com/slack/events`
   - Subscribe to the same bot events listed in the manifest

2. **Configure Interactive Components**
   - Navigate to "Interactivity & Shortcuts" in the sidebar
   - Enable Interactivity and set Request URL to: `https://your-domain.com/slack/events`

3. **Configure Slash Commands**
   - Navigate to "Slash Commands" in the sidebar
   - For each command, set Request URL to: `https://your-domain.com/slack/events`

### Bot Permissions

The bot requires the following OAuth scopes (configured in the manifest):
- `app_mentions:read` - Respond to @mentions
- `channels:history` - Read channel messages for summaries
- `channels:read` - Access channel information and metadata
- `chat:write` - Send messages to channels
- `chat:write.public` - Send messages to channels the bot hasn't joined
- `commands` - Handle slash commands
- `files:read` - Read and analyze shared files
- `groups:history` - Read private channel messages for summaries
- `groups:read` - Access private channel information
- `mpim:read` - Access multi-party direct message information
- `reactions:read` - Monitor emoji reactions on messages
- `users:read` - Access user profile information

## OpenAI Setup

### Prerequisites
- OpenAI API account with access to the Assistants API
- Sufficient API credits for your expected usage

### Setup Steps

1. **Get API Key**
   - Log in to [platform.openai.com](https://platform.openai.com)
   - Navigate to API Keys
   - Create a new secret key (starts with `sk-proj-`)

2. **Create an Assistant**
   - Go to the [Assistants Playground](https://platform.openai.com/assistants)
   - Click "Create Assistant"
   - Configure your assistant with:
     - **Model**: `gpt-4.1`
     - **Instructions**: Defines the assistant's role and behavior
     - **Tools**: Enable File Search
     - **Files**: Upload documents
   -
3. **Copy the Assistant ID** (starts with `asst_`)

