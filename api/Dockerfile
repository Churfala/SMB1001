FROM node:20-alpine AS builder
WORKDIR /app
COPY api/package*.json ./
RUN npm install
COPY api/tsconfig.json .
COPY api/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY api/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY migrations ./migrations
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "dist/index.js"]
