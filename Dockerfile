FROM node:22-alpine

WORKDIR /app

# Install root backend dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Install client frontend dependencies
COPY client/package*.json ./client/
RUN npm --prefix client install

# Copy frontend source and compile production bundle
COPY client/ ./client/
RUN npm --prefix client run build

# Copy backend application source
COPY server/ ./server/
COPY data/ ./data/
COPY uploads/ ./uploads/

# Environment and networking
ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000

# Start the application
CMD ["node", "server/index.js"]
