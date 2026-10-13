FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY app/src/main/assets/engine.js ./app/src/main/assets/engine.js
USER node
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["node", "server/http.js"]
