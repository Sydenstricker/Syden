# Build a partir da raiz do repositório: docker build -f server/Dockerfile .
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
COPY desktop/package.json desktop/
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci -w server
COPY server server
RUN npm run build -w server

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
COPY desktop/package.json desktop/
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci -w server --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist server/dist
WORKDIR /app/server
# Pasta do banco SQLite (volume no docker-compose); precisa ser gravável pelo usuário sem privilégios.
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "dist/index.js"]
