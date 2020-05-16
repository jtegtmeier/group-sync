FROM node:12

COPY . .

RUN npm run build
CMD npm start