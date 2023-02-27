FROM node as builder

WORKDIR /app

COPY Procfile  package-lock.json  package.json  server-worker.js  server.js .env ./
ADD views views
ADD public public

RUN npm install --prod

FROM astefanutti/scratch-node
# FROM ubuntu:jammy
# RUN apt-get update && apt-get install -y npm

COPY --from=builder /app .

EXPOSE 8080

ENTRYPOINT ["node", "server.js"]
