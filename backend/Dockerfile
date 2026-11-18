# 1. Imagen base: Node.js 24 en su versión Alpine (ocupa menos de 150 MB y es segura)
FROM node:26-alpine
# 2. Carpeta de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiamos el gestor de paquetes de la raíz y del backend
# (Hacemos esto antes que el código para que Docker guarde en caché las librerías)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# 4. Instalamos solo las librerías necesarias del backend (sin librerías de desarrollo)
RUN npm ci --workspace=backend --omit=dev

# 5. Copiamos el código fuente del backend y la carpeta shared (vital para legal.js)
COPY backend/ ./backend/
COPY shared/ ./shared/

# 6. Nos posicionamos donde está el servidor
WORKDIR /app/backend

# 7. Documentamos el puerto que escucha la API
EXPOSE 3100

# 8. Variables por defecto de entorno para producción
ENV PORT=3100
ENV NODE_ENV=production

# 9. Comando que arranca el servidor
CMD ["node", "src/server.js"]