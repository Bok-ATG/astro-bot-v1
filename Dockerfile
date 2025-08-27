FROM node:22-bookworm

RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

COPY --chown=node:node . .
RUN touch .env ; \
    npm ci ; \
    npm cache clean --force

CMD [ "npm", "start" ]