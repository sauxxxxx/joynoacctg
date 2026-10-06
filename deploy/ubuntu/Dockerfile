FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server ./server
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
