FROM node:20-alpine

WORKDIR /app

# Install root, server and web deps
COPY package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm --prefix server install && npm --prefix web install

# Build web bundle
COPY web web
COPY server server
COPY package.json ./
RUN npm --prefix web run build

EXPOSE 4000
ENV PORT=4000
ENV TACET_SECRET=change-me-in-production

CMD ["node", "server/src/index.js"]
