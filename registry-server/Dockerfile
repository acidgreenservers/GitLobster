FROM node:20-slim

# Set environment defaults
ENV PORT=3000
ENV NODE_ENV=production
ENV GITLOBSTER_STORAGE_DIR=/usr/src/app/storage

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
RUN apt-get update && apt-get install -y git wget gosu && rm -rf /var/lib/apt/lists/*
# Install ALL dependencies (including devDependencies for build)
# Using --include=dev to override NODE_ENV=production behavior
RUN npm install --include=dev

# Bundle app source
COPY . .

# Build frontend
RUN npm run build

# Prune dev dependencies to keep image small
RUN npm prune --production && npm cache clean --force

# Entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Ensure storage directory exists and has correct permissions
RUN mkdir -p $GITLOBSTER_STORAGE_DIR && chown -R node:node /usr/src/app

# Expose API port
EXPOSE $PORT

# Start command
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD [ "npm", "start" ]
