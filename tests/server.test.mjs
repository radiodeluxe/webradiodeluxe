import test from "node:test";
import assert from "node:assert/strict";
import handler, { signature, validCookie } from "../api/poll.js";
import {
  selectMusic,
  canonicalUrl,
} from "../supabase/functions/music-news/selection.mjs";
test("news keeps recent Portuguese music, source attribution and canonical deduplication", () => {
  const now = Date.parse("2026-10-08T01:00:00Z");
  const base = {
    title: "Música: novo álbum de rap",
    language: "pt",
    published: "2026-10-07 22:11:43 +0000",
    url: "https://example.com/music?utm_source=x",
    author: "Autor original",
  };
  const posts = selectMusic(
    [
      base,
      { ...base, url: "https://example.com/music" },
      { ...base, language: "en", url: "https://example.com/en" },
      {
        ...base,
        title: "Notícia política",
        url: "https://example.com/politics",
      },
      {
        ...base,
        published: "2020-10-07T00:00:00Z",
        url: "https://example.com/old",
      },
      {
        ...base,
        published: "2030-10-07T00:00:00Z",
        url: "https://example.com/future",
      },
    ],
    [],
    now,
  );
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "https://example.com/music");
  assert.equal(posts[0].author, "Autor original");
  assert.equal(posts[0].published, "2026-10-07T22:11:43.000Z");
  assert.equal(
    selectMusic([base], ["https://example.com/music"], now).length,
    0,
  );
  assert.equal(canonicalUrl("javascript:alert(1)"), null);
});
test("poll cookie rejects altered identities and signatures", () => {
  const id = "e37a0cf1-6604-4f3b-a8f3-f89f3442b6e3",
    secret = "test-secret";
  assert.equal(
    validCookie(`${id}.${signature(`cookie:${id}`, secret)}`, secret),
    id,
  );
  assert.equal(validCookie(`${id}.${"0".repeat(64)}`, secret), null);
  assert.equal(validCookie(`${id}.short`, secret), null);
});
test("vote API rejects other origins and GET before any database request", async () => {
  let status, body;
  const res = {
    setHeader() {},
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
    },
  };
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(status, 405);
  await handler(
    {
      method: "POST",
      headers: {
        host: "webradiodeluxe.vercel.app",
        origin: "https://attacker.example",
      },
    },
    res,
  );
  assert.equal(status, 403);
  assert.equal(body.error, "Origem inválida");
});
