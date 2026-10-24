import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  getPageSeo,
  INSTAGRAM_URL,
  programs,
  publicPaths,
  SITE_URL,
} from "../.prerender/entry-server.js";

const output = resolve("dist");
const read = (path) => readFile(resolve(output, path), "utf8");
const decoded = (text) => text.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
const meta = (html, key) => {
  const tag = html.match(new RegExp(`<meta\\b[^>]*(?:name|property)=["']${key}["'][^>]*>`, "i"))?.[0];
  return tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1];
};

for (const path of publicPaths) {
  const file = path === "/" ? "index.html" : `${path.slice(1)}/index.html`;
  const html = await read(file);
  const snapshot = JSON.parse(html.match(/<script id="site-content" type="application\/json">([\s\S]*?)<\/script>/)?.[1] || "null");
  assert.ok(snapshot && Array.isArray(snapshot.items), `${path}: conteúdo público serializado`);
  const seo = getPageSeo(path, snapshot);
  assert.match(html, /<html\b[^>]*lang="pt-BR"/i, `${path}: idioma`);
  assert.equal((html.match(/<title>/g) || []).length, 1, `${path}: título único`);
  assert.equal((html.match(/<meta\b[^>]*name="description"/g) || []).length, 1, `${path}: descrição única`);
  assert.ok(html.includes(seo.title.replaceAll("&", "&amp;")), `${path}: título esperado`);
  assert.equal(decoded(meta(html, "description") || ""), seo.description, `${path}: descrição esperada`);
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert.equal(canonical, new URL(path, SITE_URL).href, `${path}: canonical`);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1, `${path}: canonical único`);
  assert.equal(meta(html, "og:url"), canonical, `${path}: URL de compartilhamento`);
  assert.ok(meta(html, "og:image"), `${path}: imagem de compartilhamento`);
  assert.ok(meta(html, "twitter:card"), `${path}: card social`);
  assert.ok(!/noindex/i.test(meta(html, "robots") || ""), `${path}: página indexável`);
  assert.match(html, /id="root" data-prerender="true"/, `${path}: conteúdo pré-renderizado`);
  assert.match(html, /<div id="root" data-prerender="true">[^\s]/, `${path}: sem nó de texto extra antes do conteúdo hidratado`);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${path}: um h1 legível sem JavaScript`);
  assert.ok(!html.includes("<!--app-html"), `${path}: sem marcador pendente`);
  assert.ok(!html.includes("NA FREQUÊNCIA DAS NOVIDADES"), `${path}: newsletter removida`);
  if (snapshot.settings.instagram_url) assert.ok(html.includes(snapshot.settings.instagram_url.replaceAll("&", "&amp;")), `${path}: Instagram configurado`);

  const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(schemas.length > 0, `${path}: dados estruturados`);
  for (const schema of schemas) {
    assert.doesNotThrow(() => JSON.parse(schema[1]), `${path}: JSON-LD válido`);
    assert.ok(!schema[1].includes("<"), `${path}: serialização segura do JSON-LD`);
    assert.ok(!/"(?:aggregateRating|ratingValue|reviewCount)"/.test(schema[1]), `${path}: sem reputação inventada`);
  }
  assert.ok(!/pagead2\.googlesyndication\.com|adsbygoogle\.push/.test(html), `${path}: sem anúncios Google em páginas não avaliadas`);
}

for (const file of ["index.html", "programacao/index.html"]) {
  const html = await read(file);
  const snapshot = JSON.parse(html.match(/<script id="site-content" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  for (const program of snapshot.items.filter(item => item.kind === "program")) {
    assert.ok(decoded(html).includes(program.title), `${file}: programa ${program.title}`);
    assert.ok(decoded(html).includes(program.description), `${file}: descrição ${program.title}`);
  }
}

for (const file of ["admin/index.html", "404.html"]) {
  const html = await read(file);
  assert.match(meta(html, "robots") || "", /noindex/, `${file}: não indexar`);
  assert.ok(!html.includes('rel="canonical"'), `${file}: sem canonical de página pública`);
  assert.ok(!html.includes("application/ld+json"), `${file}: sem entidade pública`);
}
const admin = await read("admin/index.html");
assert.ok(!admin.includes('data-prerender="true"'), "Painel usa renderização exclusiva do cliente");
assert.ok(!admin.includes("NoBreack Hip-Hop"), "Painel não recebe HTML público");

const sitemap = await read("sitemap.xml");
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decoded(match[1]));
assert.deepEqual(locations.sort(), publicPaths.map((path) => new URL(path, SITE_URL).href).sort(), "Sitemap contém somente as páginas públicas existentes");
const robots = await read("robots.txt");
assert.match(robots, /Disallow: \/admin/, "Área administrativa fora do rastreamento");
assert.match(robots, /Disallow: \/api\//, "APIs fora do rastreamento");
assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), "Sitemap canônico em robots.txt");
assert.ok(!/^Disallow: \/\s*$/m.test(robots), "Site público rastreável");
const llms = await read("llms.txt");
for (const path of publicPaths) assert.ok(llms.includes(new URL(path, SITE_URL).href), `llms.txt: ${path}`);
const home = await read("index.html");
const snapshot = JSON.parse(home.match(/<script id="site-content" type="application\/json">([\s\S]*?)<\/script>/)[1]);
for (const program of snapshot.items.filter(item => item.kind === "program")) assert.ok(llms.includes(program.title), `llms.txt: ${program.title}`);

const config = JSON.parse(await readFile(resolve("vercel.json"), "utf8"));
assert.ok(config.rewrites.every((rewrite) => rewrite.source.startsWith("/admin") || publicPaths.includes(rewrite.source) || rewrite.source === "/llms.txt"), "Não há fallback global gerando falsos 200 em URLs inexistentes");
assert.ok(config.rewrites.filter((rewrite) => rewrite.source.startsWith("/admin")).every((rewrite) => rewrite.destination === "/admin/index.html"), "Painel tem documento separado");
for (const path of publicPaths) {
  assert.ok(config.rewrites.some((rewrite) => rewrite.source === path && rewrite.destination === `/api/render?page=${path}`), `${path}: URL canônica entrega conteúdo atual do painel em HTML`);
}
for (const area of ["/admin/:path*", "/api/:path*"]) {
  assert.ok(config.headers.some((entry) => entry.source === area && entry.headers.some((header) => header.key === "X-Robots-Tag" && header.value.includes("noindex"))), `${area}: cabeçalho noindex`);
}

const allHtml = [...publicPaths.map((path) => path === "/" ? "index.html" : `${path.slice(1)}/index.html`), "admin/index.html", "404.html"];
for (const file of allHtml) {
  const html = await read(file);
  const assets = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(\/assets\/[^"?#]+)[^"]*"/g)].map((match) => match[1]);
  assert.ok(assets.length > 0, `${file}: referências ao bundle`);
  for (const asset of assets) await access(resolve(output, `.${asset}`));
  assert.ok(!html.includes("sb_secret_") && !html.includes("SUPABASE_SERVICE_ROLE_KEY"), `${file}: sem credencial de serviço`);
}

console.log(`SEO verificado: ${publicPaths.length} páginas com HTML completo, canonicals, JSON-LD, sitemap, robots, llms, painel isolado e 404.`);
