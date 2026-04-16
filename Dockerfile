FROM node:22-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/package.json
COPY packages/warplet-activity-indexer/package.json ./packages/warplet-activity-indexer/package.json

RUN pnpm install --frozen-lockfile

COPY packages/warplet-activity-indexer ./packages/warplet-activity-indexer

ENV NODE_ENV=production

CMD ["sh", "-lc", "pnpm --filter warplet-activity-indexer codegen && pnpm --filter warplet-activity-indexer start"]
