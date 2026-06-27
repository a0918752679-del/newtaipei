FROM node:20-alpine
WORKDIR /app

# Install dependencies first for Docker layer caching.
# Do not COPY .npmrc: GitHub/Zeabur uploads often omit dotfiles, which breaks builds.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund --registry=https://registry.npmjs.org/

COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
