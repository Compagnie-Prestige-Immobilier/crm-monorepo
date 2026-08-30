FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
