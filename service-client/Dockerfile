# Development
FROM node:22-slim AS dev
WORKDIR /service

COPY package.json /service/package.json
COPY package-lock.json /service/package-lock.json
RUN npm ci --prefer-offline --no-audit || (rm -rf node_modules package-lock.json && npm install) && \
    npm install --no-save @rollup/rollup-linux-arm64-gnu@latest

COPY ./public.pem /public.pem
COPY . /service

CMD npm run dev

# Build
FROM node:22-slim AS build
WORKDIR /service

COPY package.json /service/package.json
COPY package-lock.json /service/package-lock.json
RUN npm install

COPY . /service
RUN npm run build

# Production
FROM node:22-slim AS prod
WORKDIR /service

COPY package.json /service/package.json
COPY package-lock.json /service/package-lock.json
RUN npm install --omit=dev

COPY --from=build /service/build /service/build
COPY public.pem /public.pem

SHELL ["/bin/bash", "-c"]
CMD PORT=3000 BODY_SIZE_LIMIT=10485760 node build
