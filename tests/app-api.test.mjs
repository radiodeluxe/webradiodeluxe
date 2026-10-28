import test from "node:test";
import assert from "node:assert/strict";
import { createAppHandler } from "../api/app.js";
import { APP_SITE_URL, appPublicUrl, fetchAppConfig, projectAppConfig, projectAppPoll } from "../server/app-config.mjs";

const env = {
  VITE_SUPABASE_URL: "https://public-project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "public-publishable-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_SERVICE_KEY_MUST_NEVER_APPEAR",
  POLL_WRITE_SECRET: "PRIVATE_VOTE_SECRET_MUST_NEVER_APPEAR",
};
const id = (last) => `00000000-0000-4000-8000-${String(last).padStart(12, "0")}`;
const banner = (overrides = {}) => ({
  id: id(1), title: "Anunciante cadastrado", alt_text: "Descrição do anunciante",
  image_url: "/images/hero.webp", target_url: "https://example.com/anunciante",
  slot: "top", position: 1, enabled: true, created_at: "PRIVATE_CREATED_AT", updated_at: "PRIVATE_UPDATED_AT",
  secret: "PRIVATE_BANNER_DATA", ...overrides,
});
const config = (banners = [banner()]) => ({
  settings: {
    id: 1, radio_name: "JK HipHop", tagline: "O rap em alto nível.", logo_url: null,
    background_url: "/images/hero.webp", show_poll: true, show_contact: true,
    banner_interval_seconds: 15, updated_at: "PRIVATE_UPDATED_AT", secret: "PRIVATE_SETTINGS_DATA",
  },
  radio: {
    stream_url: "https://stream.example.com/live", instagram_url: "https://instagram.com/radiojkhiphop/",
    youtube_url: "https://youtube.com/@radio", whatsapp_url: "https://wa.me/5511999999999",
    facebook_url: "https://facebook.com/radio", tiktok_url: "https://tiktok.com/@radio",
    contact_email: "contato@example.com", contact_text: "Fale com a rádio.\nEnvie sua mensagem.",
    updated_at: "PRIVATE_UPDATED_AT", secret: "PRIVATE_RADIO_DATA",
  },
  banners,
  admin_users: [{ email: "PRIVATE_ADMIN_EMAIL" }],
});
const poll = () => ({
  id: id(100), question: "Qual estilo você quer ouvir?", status: "active", ends_at: null, total: 3,
  options: [{ id: id(101), label: "Rap nacional", votes: 2, voter_hash: "PRIVATE_VOTER" }, { id: id(102), label: "Clássicos", votes: 1 }],
  private_votes: "PRIVATE_VOTES", created_at: "PRIVATE_CREATED_AT",
});
const response = (body, ok = true) => ({ ok, json: async () => body });
const requestFor = (publicConfig = config(), publicPoll = poll()) => async (url) =>
  response(url.endsWith("/poll_results") ? publicPoll : publicConfig);
function capture() {
  return {
    statusCode: undefined, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value; },
  };
}

test("app fetch uses only the public key and projects current configuration plus the existing poll", async () => {
  const calls = [];
  const value = await fetchAppConfig(env, async (url, options) => {
    calls.push(url);
    assert.ok(url.startsWith("https://public-project.supabase.co/rest/v1/rpc/"));
    assert.equal(options.method, "POST");
    assert.equal(options.body, "{}");
    assert.equal(options.headers.apikey, env.VITE_SUPABASE_PUBLISHABLE_KEY);
    assert.equal(options.headers.Authorization, `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`);
    assert.ok(options.signal instanceof AbortSignal);
    assert.doesNotMatch(JSON.stringify(options), /PRIVATE_/);
    return response(url.endsWith("/poll_results") ? poll() : config());
  });
  assert.deepEqual(calls.sort(), [
    "https://public-project.supabase.co/rest/v1/rpc/poll_results",
    "https://public-project.supabase.co/rest/v1/rpc/public_app_config",
  ]);
  assert.equal(value.schema_version, 1);
  assert.equal(value.settings.radio_name, "JK HipHop");
  assert.equal(Object.keys(value.settings).length, 10);
  assert.equal(Object.keys(value.radio).length, 8);
  assert.equal(value.settings.logo_url, null);
  assert.equal(value.settings.background_url, `${APP_SITE_URL}/images/hero.webp`);
  assert.equal(value.poll_available, true);
  assert.equal(value.poll.total, 3);
  assert.equal(value.poll.options[0].votes, 2);
  assert.doesNotMatch(JSON.stringify(value), /PRIVATE_|created_at|updated_at|admin_users|voter_hash/);
});

test("drafts, string enabled flags, unsafe images, invalid IDs, slots and positions never reach the APK", () => {
  const raw = config([
    banner({ id: id(1), position: 3 }), banner({ id: id(2), position: 0 }),
    banner({ id: id(3), slot: "bottom", position: 1, target_url: "javascript:alert(1)" }),
    banner({ id: id(4), enabled: false, title: "PRIVATE_DRAFT" }),
    banner({ id: id(5), enabled: "true", title: "PRIVATE_STRING_ENABLED" }),
    banner({ id: id(6), image_url: "https://user:password@example.com/image.png", title: "PRIVATE_CREDENTIAL_IMAGE" }),
    banner({ id: "not-a-uuid", title: "PRIVATE_ID" }),
    banner({ id: id(7), slot: "side", title: "PRIVATE_SLOT" }),
    banner({ id: id(8), position: -1, title: "PRIVATE_NEGATIVE" }),
    banner({ id: id(9), position: 10000, title: "PRIVATE_ORDER_LIMIT" }),
    banner({ id: id(10), position: 1.5, title: "PRIVATE_FRACTION" }),
    banner({ id: id(11), image_url: null, title: "PRIVATE_NO_IMAGE" }),
    banner({ id: id(2), title: "PRIVATE_DUPLICATE" }),
    null, [],
  ]);
  const value = projectAppConfig(raw);
  assert.deepEqual(value.banners.map(b => b.id), [id(2), id(1), id(3)]);
  assert.equal(value.banners[2].target_url, null);
  assert.equal(value.banners[0].image_url, `${APP_SITE_URL}/images/hero.webp`);
  assert.doesNotMatch(JSON.stringify(value), /PRIVATE_/);
});

test("URL projection accepts public HTTPS and trusted local WebP paths using the fixed site origin", () => {
  for (const input of [
    "javascript:alert(1)", "http://example.com/a", "//example.com/a", "/images/../secret.webp",
    "/images/hero.svg", "/other/hero.webp", "/images/Hero.webp", "https://user@example.com/a",
    "https://user:pass@example.com/a", "https://example.com/a\n", "https://example.com/a b",
    "https://example.com/%0Aevil", "https://example.com/%1f", "https://example.com/%7f",
    "https://example.com/\\evil", "https://", "https://example.com/" + "a".repeat(4096), null, [], {},
  ]) assert.equal(appPublicUrl(input, true), null, String(input));
  assert.equal(appPublicUrl("/images/hero.webp", true), "https://webradiodeluxe.vercel.app/images/hero.webp");
  assert.equal(appPublicUrl("/images/hero.webp"), null);
  assert.equal(appPublicUrl("https://example.com/a?b=1#x"), "https://example.com/a?b=1#x");
  const raw = config();
  raw.settings.logo_url = "https://user:pass@example.com/logo.png";
  raw.settings.background_url = "javascript:alert(1)";
  raw.radio.stream_url = "http://stream.example.com/live";
  raw.radio.contact_email = "contato@example.com?subject=bad";
  const value = projectAppConfig(raw);
  assert.equal(value.settings.logo_url, null);
  assert.equal(value.settings.background_url, null);
  assert.equal(value.radio.stream_url, null);
  assert.equal(value.radio.contact_email, null);
});

test("invalid environments fail before any upstream fetch and cannot use administrative keys", async () => {
  let calls = 0;
  const request = async () => { calls++; throw new Error("Unexpected upstream request"); };
  const jwt = `e30.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  for (const invalid of [
    {}, { ...env, VITE_SUPABASE_URL: "http://project.supabase.co" },
    { ...env, VITE_SUPABASE_URL: "https://user:password@project.supabase.co" },
    { ...env, VITE_SUPABASE_URL: "https://project.supabase.co/path" },
    { ...env, VITE_SUPABASE_URL: "https://project.supabase.co?query=bad" },
    { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "public\nkey" },
    { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_PRIVATE" },
    { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: jwt },
  ]) await assert.rejects(fetchAppConfig(invalid, request), /connection unavailable/);
  assert.equal(calls, 0);
});

test("malformed configuration never publishes fabricated defaults", async () => {
  for (const raw of [null, [], {}, { settings: [], radio: {}, banners: [] },
    { ...config(), radio: [] }, { ...config(), banners: {} },
    { ...config(), settings: {} },
    { ...config(), settings: { ...config().settings, show_poll: "true" } },
    { ...config(), settings: { ...config().settings, banner_interval_seconds: 3 } },
  ]) {
    assert.throws(() => projectAppConfig(raw), /Invalid app configuration/);
    await assert.rejects(fetchAppConfig(env, requestFor(raw)), /configuration unavailable/);
  }
  const raw = config([]);
  delete raw.settings.logo_url;
  delete raw.settings.background_url;
  const value = projectAppConfig(raw);
  assert.deepEqual(value.banners, []);
  assert.equal(value.settings.logo_url, null);
  assert.equal(value.settings.background_url, null);
});

test("no active poll remains available and independent poll failures do not hide a working radio", async () => {
  const noPoll = await fetchAppConfig(env, requestFor(config(), null));
  assert.equal(noPoll.poll, null);
  assert.equal(noPoll.poll_available, true);
  for (const brokenPoll of [
    async () => { throw new Error("PRIVATE_POLL_ERROR"); },
    async () => response({ message: "PRIVATE_PROVIDER_ERROR" }, false),
    async () => response({ id: "malformed" }),
    async () => ({ ok: true, json: async () => { throw new Error("PRIVATE_JSON_ERROR"); } }),
  ]) {
    const value = await fetchAppConfig(env, async (url) => url.endsWith("/poll_results") ? brokenPoll() : response(config()));
    assert.equal(value.poll_available, false);
    assert.equal(value.poll, null);
    assert.equal(value.radio.stream_url, config().radio.stream_url);
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE_/);
  }
});

test("poll projection validates choices, votes and totals and strips private vote metadata", () => {
  const value = projectAppPoll(poll());
  assert.equal(value.total, 3);
  assert.deepEqual(Object.keys(value.options[0]), ["id", "label", "votes"]);
  assert.doesNotMatch(JSON.stringify(value), /PRIVATE_/);
  for (const raw of [
    [], {}, { ...poll(), total: 99 }, { ...poll(), status: "draft" },
    { ...poll(), ends_at: "invalid-date" }, { ...poll(), options: [poll().options[0]] },
    { ...poll(), options: [poll().options[0], poll().options[0]] },
    { ...poll(), options: [{ ...poll().options[0], votes: -1 }, poll().options[1]] },
  ]) assert.throws(() => projectAppPoll(raw), /Invalid poll response/);
});

test("GET and HEAD expose the same status and safe headers without trusting Host for image URLs", async () => {
  let calls = 0;
  const handler = createAppHandler({ env, request: async (...args) => { calls++; return requestFor()(...args); } });
  const get = capture();
  await handler({ method: "GET", headers: { host: "attacker.example" } }, get);
  assert.equal(get.statusCode, 200);
  assert.equal(get.headers["cache-control"], "no-store");
  assert.equal(get.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(get.headers["x-robots-tag"], "noindex, nofollow");
  assert.equal(get.headers["x-content-type-options"], "nosniff");
  assert.equal(JSON.parse(get.body).banners[0].image_url, `${APP_SITE_URL}/images/hero.webp`);
  assert.doesNotMatch(get.body, /attacker\.example|PRIVATE_/);
  const head = capture();
  await handler({ method: "HEAD", headers: { host: "attacker.example" } }, head);
  assert.equal(head.statusCode, 200);
  assert.equal(head.body, undefined);
  assert.deepEqual(head.headers, get.headers);
  assert.equal(calls, 4);
});

test("unsupported API methods return 405 before reading the environment or calling the provider", async () => {
  let calls = 0;
  const handler = createAppHandler({ env: {}, request: async () => { calls++; throw new Error("PRIVATE_ERROR"); } });
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", undefined]) {
    const res = capture();
    await handler({ method }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, "GET, HEAD");
    assert.equal(res.headers["cache-control"], "no-store");
    assert.deepEqual(JSON.parse(res.body), { error: "Método inválido" });
  }
  assert.equal(calls, 0);
});

test("config errors produce generic 503 responses and HEAD failures have no response body", async () => {
  for (const request of [
    async () => { throw new Error("PRIVATE_PROVIDER_ERROR_WITH_TOKEN"); },
    async () => response({ error: "PRIVATE_PROVIDER_BODY" }, false),
    async () => ({ ok: true, json: async () => { throw new Error("PRIVATE_PARSE_ERROR"); } }),
  ]) {
    const handler = createAppHandler({ env, request });
    for (const method of ["GET", "HEAD"]) {
      const res = capture();
      await handler({ method }, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.headers["retry-after"], "30");
      assert.equal(res.headers["cache-control"], "no-store");
      if (method === "HEAD") assert.equal(res.body, undefined);
      else {
        assert.match(JSON.parse(res.body).error, /temporariamente indisponível/);
        assert.doesNotMatch(res.body, /PRIVATE_|SUPABASE|secret|token/);
      }
    }
  }
});


test("ticker projection permits only plain bounded text and black or white with safe legacy defaults", () => {
  const raw = config();
  assert.deepEqual(Object.fromEntries(Object.entries(projectAppConfig(raw).settings).filter(([k]) => k.startsWith("ticker_"))), {
    ticker_enabled: false, ticker_text: "", ticker_text_color: "black",
  });
  Object.assign(raw.settings, {ticker_enabled: true, ticker_text: "JK HipHop • Sua mensagem", ticker_text_color: "white"});
  assert.equal(projectAppConfig(raw).settings.ticker_text_color, "white");
  assert.equal(projectAppConfig(raw).settings.ticker_enabled, true);
  for (const value of ["", "   ", "x".repeat(301), "line\nline", null, {}]) {
    raw.settings.ticker_text = value;
    assert.equal(projectAppConfig(raw).settings.ticker_enabled, false);
  }
  Object.assign(raw.settings, {ticker_enabled: "true", ticker_text: "Texto", ticker_text_color: "red"});
  assert.equal(projectAppConfig(raw).settings.ticker_enabled, false);
  assert.equal(projectAppConfig(raw).settings.ticker_text_color, "black");
});
