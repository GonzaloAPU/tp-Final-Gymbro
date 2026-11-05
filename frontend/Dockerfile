# ==========================================
# ETAPA 1: Compilación de Angular 22
# ==========================================
FROM node:26-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

RUN npm ci --workspace=frontend

# Copiamos tanto el frontend como la carpeta shared
COPY frontend/ ./frontend/
COPY shared/ ./shared/

WORKDIR /app/frontend
RUN npm run build

# ==========================================
# ETAPA 2: Servidor web Nginx de producción
# ==========================================
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist/smartgymbro/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]