FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

CMD ["sh", "-c", "npx ts-node src/migrations/setupDatabase.ts && npx ts-node src/example.ts"]
