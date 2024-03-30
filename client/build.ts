import lightningcss from 'bun-lightningcss'

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  plugins: [lightningcss()],
  minify: true,
});

await Bun.serve({
  port: 3000,
  fetch(req: Request) {
    const path = new URL(req.url).pathname;

    switch (path) {
      case "/":
        return new Response(Bun.file("./dist/index.html"), {
          headers: { "Content-Type": "text/html" },
        });
      default:
        return new Response(Bun.file("./dist" + path));
    }
  },
})
