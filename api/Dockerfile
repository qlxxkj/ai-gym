FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js claude.js name-zh.js ./
ENV NODE_ENV=production
EXPOSE 4010
CMD ["node", "server.js"]
