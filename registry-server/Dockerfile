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
RUN npm install --production && npm cache clean --force

# Bundle app source
COPY . .

# Ensure storage directory exists and has correct permissions
RUN mkdir -p $GITLOBSTER_STORAGE_DIR && chown -R node:node /usr/src/app

# Switch to non-root user for security
USER node

# Expose API port
EXPOSE $PORT

# Start command
CMD [ "npm", "start" ]
