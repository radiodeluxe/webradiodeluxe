import assert from "node:assert/strict";
import { access, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { publicPaths } from "../.prerender/entry-server.js";

const output = resolve("dist");
// Vercel serves an existing static file before applying a rewrite. Keep local
// prerender output for verification, then omit only documents served by SSR.
const files = [
  ...publicPaths.map(path => path === "/" ? "index.html" : `${path.slice(1)}/index.html`),
  "llms.txt",
];
await Promise.all([
  ".prerender/template.html", ".prerender/entry-server.js",
  "dist/admin/index.html", "dist/404.html", "dist/robots.txt", "dist/sitemap.xml",
].map(file => access(resolve(file))));
for (const file of files) {
  const target = resolve(output, file);
  assert.ok(target.startsWith(`${output}${sep}`), "Document must remain inside the build output");
  await unlink(target);
}
console.log(`Vercel preparado: ${files.length} documentos serão entregues pelo renderizador atual; arquivos estáticos e painel preservados.`);
