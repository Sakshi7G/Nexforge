# Stage 1: Build Frontend
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:18-alpine AS runner
WORKDIR /app

# Install Docker CLI and Git inside container for PTY/Git sandbox access
RUN apk add --no-linux-headers --no-cache docker-cli git powershell bash

COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/package.json
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY --from=client-builder /app/client/dist ./client/dist

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "server/dist/server.js"]
