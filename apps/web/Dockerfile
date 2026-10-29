# Web de CodeAI Academy (Next.js). Contexto de construcción: la raíz del monorepo.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.ejemplo.com/api -t codeai-web .
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @codeai/web --workspace @codeai/shared --include-workspace-root
COPY packages/shared packages/shared
COPY apps/web apps/web
# `NEXT_PUBLIC_*` se incrusta en el bundle al compilar: debe darse aquí, no al ejecutar.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @codeai/shared && npm run build -w @codeai/web \
  && npm prune --omit=dev --workspace @codeai/web --workspace @codeai/shared

FROM node:22-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY --from=build --chown=node:node /repo/node_modules node_modules
COPY --from=build --chown=node:node /repo/packages/shared packages/shared
COPY --from=build --chown=node:node /repo/apps/web apps/web
USER node
WORKDIR /repo/apps/web
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
