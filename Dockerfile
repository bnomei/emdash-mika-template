FROM node:24-bookworm-slim AS build

# better-sqlite3 13 builds its native addon from source.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor ./vendor
COPY scripts/patch-emdash-dev-bypass.mjs ./scripts/patch-emdash-dev-bypass.mjs
RUN npm ci

COPY . .

# These values are embedded by the Astro build. Runtime startup uses the same
# paths, and Railway mounts the persistent volume at /data.
ENV EMDASH_MIKA_TEMPLATE_SKIP_LOCAL_BUILD=1 \
  EMDASH_DATA_DIR=/data \
  EMDASH_DATABASE_URL=file:/data/mika-template.sqlite \
  EMDASH_MIKA_TEMPLATE_DB=/data/mika-template.sqlite \
  EMDASH_STORAGE_DIRECTORY=/data/uploads \
  EMDASH_SESSION_DIRECTORY=/data/sessions \
  EMDASH_SITE_URL=https://mika-demo.bnomei.com

RUN npm run build \
  && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  EMDASH_MIKA_TEMPLATE_SKIP_LOCAL_BUILD=1 \
  EMDASH_DATA_DIR=/data \
  EMDASH_DATABASE_URL=file:/data/mika-template.sqlite \
  EMDASH_MIKA_TEMPLATE_DB=/data/mika-template.sqlite \
  EMDASH_STORAGE_DIRECTORY=/data/uploads \
  EMDASH_SESSION_DIRECTORY=/data/sessions \
  EMDASH_SITE_URL=https://mika-demo.bnomei.com

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/seed ./seed

EXPOSE 4321

CMD ["npm", "run", "start"]
