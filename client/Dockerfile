FROM node:18-alpine

WORKDIR /app

ENV npm_config_target_platform=linux
ENV npm_config_target_arch=arm64

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]