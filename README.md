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

The bot uses Slack's [socket mode](https://api.slack.com/apis/socket-mode) for event handling, which does not require exposing a public HTTP Request URL.

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

   **Option A: Node.js**
   ```bash
   npm install
   npm start
   ```

   **Option B: Docker**
   ```bash
   docker compose up
   ```

## Environment Variables

Create a `.env` file based on `.env.sample` with the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SLACK_CLIENT_ID` | Slack app client ID | Found in "Basic Information" |
| `SLACK_CLIENT_SECRET` | Slack app client secret | Found in "Basic Information" |
| `SLACK_SIGNING_SECRET` | Used to verify requests from Slack | Found in "Basic Information" |
| `SLACK_APP_TOKEN` | App-level token for Socket Mode | Found in "Basic Information" > "App-Level Tokens" |
| `SLACK_BOT_TOKEN` | Bot user OAuth token | Found in "OAuth & Permissions" |
| `OPENAI_API_KEY` | OpenAI API secret key | Found in OpenAI platform > "API Keys" |
| `OPENAI_ASSISTANT_ID` | ID of your OpenAI Assistant | Found in Assistants Playground |
| `SLACK_CHANNEL_ID` | Default channel for bot operations | Found in Slack channel URL or settings |


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
     - **Client ID**
     - **Client Secret**
     - **Signing Secret**

4. **Generate App-Level Token**
   - Still in "Basic Information", scroll down to "App-Level Tokens"
   - Click "Generate Token and Scopes"
   - Add the `connections:write` scope
   - Generate the token and copy it (starts with `xapp-`)

5. **Install to Workspace**
   - Navigate to "Install App" in the sidebar
   - Click "Install to Workspace"
   - Authorize the required permissions
   - Copy the **Bot User OAuth Token** from "OAuth & Permissions" (starts with `xoxb-`)

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

