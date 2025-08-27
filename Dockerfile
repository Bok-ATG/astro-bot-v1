FROM node:22-bookworm

RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

# Copy package files first for better layer caching
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm ci && \
    npm cache clean --force

# Copy application code
COPY --chown=node:node . .

# Expose health check port
EXPOSE 3000

# Configure health check using dedicated health check script
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
  CMD node health-check.js

CMD [ "npm", "start" ]