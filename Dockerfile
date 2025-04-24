# Étape 1 : build TS
FROM node:20-slim AS builder

WORKDIR /app

# On installe toutes les dépendances et on génère le client Prisma
COPY package*.json tsconfig.json ./
RUN npm install --frozen-lockfile
COPY src/prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# On compile le TS en JS
COPY src ./src
RUN npm run build


# Étape 2 : runtime minimal
FROM node:20-slim AS runner

WORKDIR /app

# On copie uniquement ce dont on a besoin en prod :
# - package.json (pour npm ci)
# - node_modules (seulement prod deps)
# - le JS compilé dans dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# (Optionnel) si vous avez besoin d'autres fichiers,
# vous pouvez les copier ici (ex. .env, certificats, etc.)

ENV NODE_ENV=production
EXPOSE 5000

# On lance directement le JS compilé.
# Remplacez "index.js" par le point d'entrée réel de votre app.
CMD ["node", "dist/index.js"]
