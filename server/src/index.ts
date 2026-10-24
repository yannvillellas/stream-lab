import { createStreamLabServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const host = process.env.HOST ?? "127.0.0.1";
const server = createStreamLabServer();

server
  .listen(port, host)
  .then((actualPort) => {
    console.log(`Signalling server listening on ${host}:${actualPort}`);
  })
  .catch((error: unknown) => {
    console.error("Failed to start the signalling server", error);
    process.exitCode = 1;
  });

const shutdown = () => {
  void server.close().finally(() => {
    process.exit(0);
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
