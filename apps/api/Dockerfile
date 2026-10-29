# API de CodeAI Academy (NestJS). Contexto de construcción: la raíz del monorepo.
#   docker build -f apps/api/Dockerfile -t codeai-api .
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @codeai/api --workspace @codeai/shared --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @codeai/shared \
  && npm run db:generate -w @codeai/api \
  && npm run build -w @codeai/api \
  && npm prune --omit=dev --workspace @codeai/api --workspace @codeai/shared

FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo/node_modules node_modules
COPY --from=build --chown=node:node /repo/packages/shared packages/shared
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/prisma apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/package.json apps/api/package.json
USER node
WORKDIR /repo/apps/api
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
