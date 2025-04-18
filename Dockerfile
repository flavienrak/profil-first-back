# Étape 1 : Builder avec TypeScript
FROM node:20-slim AS builder

# Répertoire de travail
WORKDIR /app

# Copier les fichiers nécessaires
COPY package*.json tsconfig.json ./
RUN npm install

# Copier le code source
COPY ./src ./src

# Génére le client Prisma
RUN npx prisma generate --schema=src/prisma/schema.prisma

# Compiler TypeScript → JavaScript (dans /dist)
RUN npm run build

# Étape 2 : Exécution en production
FROM node:20-slim AS runner

WORKDIR /app

# Copier les fichiers nécessaires à l'exécution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Copier aussi le client Prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copier le fichier schema.prisma (nécessaire pour Prisma Client)
COPY --from=builder /app/src/prisma/schema.prisma ./src/prisma/schema.prisma

# Exposer le port utilisé par Express
EXPOSE 5000

# Commande de démarrage
CMD ["npm", "run", "serve"]
