FROM node:22-alpine

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy application source and build the Vite frontend bundle
COPY . .
RUN npm run build

# Persist SQLite database in /app/data by default (override with DATABASE_PATH)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
