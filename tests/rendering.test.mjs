import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeSiteContent, publicPaths } from "../.prerender/entry-server.js";
import { fetchPublicContent, serializeSnapshot, renderDocument, renderLlms } from "../server/site-renderer.mjs";

const publicEnv = {
  VITE_SUPABASE_URL: "https://public-project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "public-publishable-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_TEST_KEY_MUST_NEVER_APPEAR",
};
const item = (overrides = {}) => ({
  id: "00000000-0000-4000-8000-000000000001", kind: "program",
  title: "Programa administrado de teste", description: "Descrição editada no painel.",
  image_url: "/images/hero.webp", link_url: "https://example.com/programa",
  time_label: "19H — 21H", days_label: "TER E QUI", position: 0, enabled: true,
  ...overrides,
});
const payload = (items = [item()]) => ({
  items,
  settings: {
    stream_url: null, instagram_url: "https://www.instagram.com/perfileditado/",
    youtube_url: "https://www.youtube.com/@canaleditado", contact_email: "radio@example.com",
    contact_text: "Fale com a equipe pelo canal atualizado.", whatsapp_url: "https://wa.me/5511999999999",
    facebook_url: "https://www.facebook.com/perfileditado", tiktok_url: "https://www.tiktok.com/@perfileditado",
    private_key: "PRIVATE_TEST_KEY_MUST_NEVER_APPEAR",
  },
  admin_users: [{ email: "PRIVATE_ADMIN_MUST_NEVER_APPEAR" }],
});

test("public RPC fetch uses the publishable key and whitelists only enabled public fields", async () => {
  let called = 0;
  const raw = payload([
    item({ position: 3, secret: "PRIVATE_ITEM_MUST_NEVER_APPEAR" }),
    item({ id: "draft", enabled: false, title: "PRIVATE_DRAFT_MUST_NEVER_APPEAR" }),
    item({ id: "string-false", enabled: "false", title: "PRIVATE_STRING_MUST_NEVER_APPEAR" }),
    item({ id: "unknown-kind", kind: "admin", title: "PRIVATE_KIND_MUST_NEVER_APPEAR" }),
    item({ id: "first", kind: "team", position: 0, image_url: "javascript:alert(1)", link_url: "data:text/html,bad" }),
  ]);
  const snapshot = await fetchPublicContent(publicEnv, async (url, options) => {
    called++;
    assert.equal(url, "https://public-project.supabase.co/rest/v1/rpc/public_site_content");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY);
    assert.equal(options.headers.Authorization, `Bearer ${publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY}`);
    assert.equal(options.body, "{}");
    assert.ok(options.signal instanceof AbortSignal);
    assert.doesNotMatch(JSON.stringify(options), /PRIVATE_TEST_KEY/);
    return { ok: true, json: async () => raw };
  });
  assert.equal(called, 1);
  assert.deepEqual(snapshot.items.map(entry => entry.id), ["first", raw.items[0].id]);
  assert.equal(snapshot.items[0].image_url, null);
  assert.equal(snapshot.items[0].link_url, null);
  assert.equal(Object.keys(snapshot.settings).length, 8);
  assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE_/);
});

test("missing configuration, failed RPC and malformed snapshots fail instead of publishing stale defaults", async () => {
  let calls = 0;
  const request = async () => { calls++; return { ok: false }; };
  await assert.rejects(fetchPublicContent({}, request), /connection unavailable/);
  assert.equal(calls, 0);
  await assert.rejects(fetchPublicContent(publicEnv, request), /content unavailable/);
  for (const invalid of [null, [], {}, { items: [], settings: [] }, { items: {}, settings: {} }]) {
    assert.equal(normalizeSiteContent(invalid), null);
    await assert.rejects(fetchPublicContent(publicEnv, async () => ({ ok: true, json: async () => invalid })), /Invalid public content response/);
  }
  const empty = normalizeSiteContent(payload([]));
  assert.deepEqual(empty.items, []);
  assert.equal(empty.settings.instagram_url, payload().settings.instagram_url);
});

test("snapshot JSON safely round-trips script terminators and special Unicode characters", () => {
  const value = { text: '</script><script>alert("x")</script>&\u2028\u2029' };
  const serialized = serializeSnapshot(value);
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/);
  assert.deepEqual(JSON.parse(serialized), value);
});

test("request-time HTML contains current published programs and settings without private data or script injection", async () => {
  const title = 'Programa <script>alert("x")</script>';
  const raw = payload([
    item({ title }),
    item({ id: "private-draft", enabled: false, title: "PRIVATE_DRAFT_MUST_NEVER_APPEAR" }),
  ]);
  const snapshot = await fetchPublicContent(publicEnv, async () => ({ ok: true, json: async () => raw }));
  const template = await readFile(new URL("../.prerender/template.html", import.meta.url), "utf8");
  const document = renderDocument(template, "/programacao", snapshot);
  assert.match(document, /Programa &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(document, /Descrição editada no painel\./);
  assert.match(document, /19H — 21H/);
  assert.match(document, /TER E QUI/);
  assert.match(document, /https:\/\/www\.instagram\.com\/perfileditado\//);
  assert.ok(/<div id="root" data-prerender="true"><[a-z]/i.test(document), "hydration root must begin immediately with an element");
  assert.doesNotMatch(document, /PRIVATE_|<script>alert\("x"\)<\/script>/);
  assert.doesNotMatch(document, /<!--(?:seo-head|app-html)-(?:start|end)-->/);
  const embedded = document.match(/<script id="site-content" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]), snapshot);
  const schema = document.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(schema);
  const data = JSON.parse(schema[1]);
  assert.ok(data["@graph"].some(entry => entry["@type"] === "ItemList" && entry.itemListElement[0].item.name === title));
  assert.ok(data["@graph"].find(entry => entry["@type"] === "Organization").sameAs.includes(snapshot.settings.instagram_url));
});

test("contact page and all public routes render the current contact configuration", async () => {
  const content = normalizeSiteContent(payload());
  const template = await readFile(new URL("../.prerender/template.html", import.meta.url), "utf8");
  const contact = renderDocument(template, "/contato", content);
  assert.match(contact, /Fale com a equipe pelo canal atualizado\./);
  assert.match(contact, /mailto:radio@example\.com/);
  assert.match(contact, /https:\/\/wa\.me\/5511999999999/);
  for (const path of publicPaths) {
    const document = renderDocument(template, path, content);
    assert.equal((document.match(/<h1(?:\s|>)/g) || []).length, 1, `${path} must have one visible page heading`);
    assert.match(document, /<link rel="canonical"/);
    assert.doesNotMatch(document, /PRIVATE_/);
  }
});

test("llms.txt follows edited programs and social URLs and omits unpublished entries", () => {
  const content = normalizeSiteContent(payload([
    item(), item({ id: "private", enabled: false, title: "PRIVATE_DRAFT_MUST_NEVER_APPEAR" }),
    item({ id: "team", kind: "team", title: "Pessoa cadastrada" }),
  ]));
  const text = renderLlms(content);
  assert.match(text, /Programa administrado de teste/);
  assert.match(text, /Descrição editada no painel/);
  assert.match(text, /https:\/\/www\.instagram\.com\/perfileditado\//);
  assert.doesNotMatch(text, /PRIVATE_|Pessoa cadastrada/);
});

function responseCapture() {
  return {
    statusCode: undefined, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
  };
}

test("render API rejects unsupported methods and paths before fetching public content", async () => {
  const { default: handler } = await import("../api/render.js");
  const savedFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected content request"); };
  try {
    const method = responseCapture();
    await handler({ method: "POST", url: "/api/render?page=/" }, method);
    assert.equal(method.statusCode, 405);
    assert.equal(method.headers.allow, "GET, HEAD");
    const path = responseCapture();
    await handler({ method: "GET", url: "/api/render?page=/admin" }, path);
    assert.equal(path.statusCode, 404);
    assert.equal(path.headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = savedFetch; }
});

test("render API returns current public HTML, supports HEAD and hides provider failures", async () => {
  const { default: handler } = await import("../api/render.js");
  const savedFetch = globalThis.fetch;
  const savedEnvironment = Object.fromEntries(Object.keys(publicEnv).map(key => [key, process.env[key]]));
  Object.assign(process.env, publicEnv);
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => payload() });
    const success = responseCapture();
    await handler({ method: "GET", url: "/api/render?page=/programacao" }, success);
    assert.equal(success.statusCode, 200);
    assert.equal(success.headers["cache-control"], "no-store");
    assert.match(success.headers["content-type"], /text\/html/);
    assert.match(success.body, /Programa administrado de teste/);
    assert.doesNotMatch(success.body, /PRIVATE_/);
    const head = responseCapture();
    await handler({ method: "HEAD", url: "/api/render?page=/llms.txt" }, head);
    assert.equal(head.statusCode, 200);
    assert.match(head.headers["content-type"], /text\/plain/);
    assert.equal(head.body, undefined);
    globalThis.fetch = async () => { throw new Error("PRIVATE_PROVIDER_ERROR_MUST_NEVER_APPEAR"); };
    const failure = responseCapture();
    await handler({ method: "GET", url: "/api/render?page=/" }, failure);
    assert.equal(failure.statusCode, 503);
    assert.equal(failure.headers["retry-after"], "30");
    assert.doesNotMatch(failure.body, /PRIVATE_/);
  } finally {
    globalThis.fetch = savedFetch;
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
