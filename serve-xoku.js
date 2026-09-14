// serve-xoku.js — serves the built site (./out) on port 3002
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3002;
const ROOT = path.join(__dirname, "out");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, "index.html"); // SPA fallback
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return; }
    const ext = path.extname(file).toLowerCase();
    const immutable = file.includes(`${path.sep}_next${path.sep}static${path.sep}`);
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Xoku static server -> http://localhost:${PORT}`));
