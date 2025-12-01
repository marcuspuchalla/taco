FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Copy application
COPY runner.js ./

# Create directories for tests and reports
RUN mkdir -p /tests /reports

# Run runner
CMD ["node", "runner.js"]
