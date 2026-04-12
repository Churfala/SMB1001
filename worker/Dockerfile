FROM node:20-alpine AS builder
WORKDIR /app
COPY worker/package*.json ./
RUN npm install
COPY worker/tsconfig.json .
COPY worker/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY worker/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
