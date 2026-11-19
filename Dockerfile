# An app made from the starting kit, in two stages. The first stage has the
# development packages and builds the firing line's 3D picture,
# public/scene.min.js, from src/scene/ (esbuild and three; the file is not
# stored in the repository since range-day-seven). The second stage is the
# source tree plus Node and the runtime packages only (the two Sentry
# packages; the browser bundle public/sentry.min.js is committed, not built
# here), with the built picture copied in. The image build fails if the
# picture file is missing or empty. (The three apps add python3, make and
# g++ here only once they use better-sqlite3; see docs/NEW-APP.md.)
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN node scripts/build-scene.mjs && test -s public/scene.min.js

FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
COPY --from=build /app/public/scene.min.js public/scene.min.js
RUN test -s public/scene.min.js || (echo "public/scene.min.js is missing from the image" && exit 1)

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
