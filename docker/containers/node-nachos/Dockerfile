FROM node:20-alpine

WORKDIR /app

# Copy the nachos library (will be mounted as volume or copied during build)
COPY nachos /nachos

# Copy package files
COPY package.json ./

# Install dependencies (nachos from local path)
RUN npm install --production

# Copy application
COPY server.js ./

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run server
CMD ["node", "server.js"]
