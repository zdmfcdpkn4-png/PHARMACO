# --- Étape 1 : build du frontend Vite ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# API servie en relatif "/api" (proxifiée par nginx) -> aucun domaine figé,
# pas de souci CORS (même origine). Surchargé par docker-compose si besoin.
ARG VITE_API_URL=/api
ARG VITE_USE_MOCK=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_USE_MOCK=$VITE_USE_MOCK
RUN npm run build

# --- Étape 2 : service statique nginx + proxy /api ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
