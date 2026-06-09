# API PHARMACO (Express + PostgreSQL)
FROM node:20-alpine

WORKDIR /app

# Dépendances (couche cache)
COPY package*.json ./
RUN npm install --omit=dev

# Code + fichiers SQL (schema.sql / seed.sql lus par la migration au démarrage)
COPY src ./src
COPY db ./db

# En production, AUTH_SECRET est obligatoire (fourni via docker-compose).
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/index.js"]
