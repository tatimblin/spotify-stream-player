const server = Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response("Hello Bunner!");
  },
});

console.log(`Listening on port ${server.port}`);