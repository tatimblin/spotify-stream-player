import { withHtmlLiveReload } from "bun-html-live-reload";

export default withHtmlLiveReload({
  port: 3000,
  fetch(req) {
    const path = new URL(req.url).pathname;

    switch (path) {
      case "/":
        return new Response(Bun.file("./dist/index.html"), {
          headers: { "Content-Type": "text/html" },
        });
      default:
        return new Response(Bun.file("./" + path));
    }
  },
});