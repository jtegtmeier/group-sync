FROM node:12

COPY . .

RUN rm -rf ./node_modules/groupme/.git \
    && npm i \
    && npm run build
CMD npm start