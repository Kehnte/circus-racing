FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx drizzle-kit push
EXPOSE 3000
CMD ["node", "server.js"]
