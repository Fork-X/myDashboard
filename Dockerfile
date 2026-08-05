FROM node:24.18-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm test && npm run build

FROM node:24.18-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/app/data HOST=0.0.0.0 PORT=3015
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/db ./db
EXPOSE 3015
CMD ["node", "server/index.mjs"]
