# Etapa 1: build da aplicação SSR Nitro/React
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Permite override do preset Nitro via build arg (node-server, vercel, cloudflare-module, etc.)
ARG NITRO_PRESET=node-server
ENV NITRO_PRESET=$NITRO_PRESET

# Variáveis VITE precisam existir em tempo de BUILD (são substituídas no bundle)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

RUN npm run build

# Etapa 2: imagem final com Node.js para executar o servidor Nitro SSR
FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=build /app/.output ./.output

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
