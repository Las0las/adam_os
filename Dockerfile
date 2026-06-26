# Phase 9 — production Next.js image.
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# Dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runtime (non-root)
FROM base AS runner
RUN useradd --system --uid 1001 lawrence
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
USER lawrence
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>r.json()).then(b=>process.exit(b.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
