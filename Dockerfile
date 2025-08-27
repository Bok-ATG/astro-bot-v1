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

CMD [ "npm", "start" ]