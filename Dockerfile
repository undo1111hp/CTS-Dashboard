FROM node:20-alpine AS base

# Set working directory
WORKDIR /usr/src/app

# Copy dependency configs
COPY package*.json ./

# Install npm packages
RUN npm ci

# Copy configuration files
COPY tsconfig.json drizzle.config.ts ./

# Copy source code, migration folders and tests
COPY db/ ./db/
COPY utils/ ./utils/
COPY services/ ./services/
COPY test_sync.ts ./
COPY drizzle/ ./drizzle/

# Expose app port (default 3000)
EXPOSE 3000

# Set start script which runs migrations, seeds data, and starts verification
CMD ["npm", "start"]
