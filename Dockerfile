FROM node:16-alpine

WORKDIR /usr/mc

COPY package.json .
COPY package-lock.json .

RUN npm install

COPY src ./src

ENTRYPOINT node_modules/forever/bin/forever -m 5 --spinSleepTime 60000 --minUptime 10000 src/index.js