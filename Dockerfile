# Use official Node.js image as the base
FROM node:20-alpine AS builder

# Set work directory
WORKDIR /app

# Install dependencies
COPY package.json /app/
COPY package-lock.json /app/
RUN npm install


# Copy project
COPY . /app/

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "dev"]
