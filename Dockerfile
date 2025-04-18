# Étape 1 : Builder avec TypeScript
FROM node:20-slim AS builder

# Répertoire de travail
WORKDIR /app

# Copier les fichiers nécessaires
COPY package*.json tsconfig.json ./
RUN npm install

# Copier le code source
COPY ./src ./src

# Compiler TypeScript → JavaScript (dans /dist)
RUN npm run build

# Étape 2 : Exécution en production
FROM node:20-slim AS runner

WORKDIR /app

# Copier les fichiers nécessaires à l'exécution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Exposer le port utilisé par Express (ex. 3000)
EXPOSE 3000

# Commande de démarrage
CMD ["npm", "run", "serve"]
