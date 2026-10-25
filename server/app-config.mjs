export const APP_SITE_URL = "https://webradiodeluxe.vercel.app";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controls = /[\u0000-\u001f\u007f-\u009f]/u;
const unsafeUrlCharacters = /[\s\\\u0000-\u001f\u007f-\u009f]/u;
const localImage = /^\/images\/[a-z0-9][a-z0-9_-]*\.webp$/;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;

function text(value, limit, minimum = 0) {
  return typeof value === "string" && value.length <= limit && value.trim().length >= minimum
    && !controls.test(value) ? value : null;
}

/** Only public HTTPS links. Relative image paths always use our fixed site. */
export function appPublicUrl(value, image = false) {
  if (typeof value !== "string" || value.length > 4096 || unsafeUrlCharacters.test(value)
    || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return null;
  if (image && localImage.test(value)) return new URL(value, APP_SITE_URL).href;
  if (!/^https:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function connection(env) {
  const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  const rawUrl = env?.VITE_SUPABASE_URL;
  const url = appPublicUrl(rawUrl);
  if (!url || typeof key !== "string" || !key || key.length > 8192 || /\s|[^\x21-\x7e]/.test(key)
    || key.startsWith("sb_secret_")) throw new Error("App connection unavailable");
  const parsed = new URL(url);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("App connection unavailable");
  // A misconfigured legacy service-role JWT must never be used by this API.
  if (key.split(".").length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      if (claims.role && claims.role !== "anon") throw new Error("Invalid public key role");
    } catch { throw new Error("App connection unavailable"); }
  }
  return { url: parsed.origin, key };
}

/** Explicit projection: never pass provider properties, timestamps or drafts on. */
export function projectAppConfig(raw) {
  if (!isRecord(raw) || !isRecord(raw.settings) || !isRecord(raw.radio) || !Array.isArray(raw.banners)) {
    throw new Error("Invalid app configuration");
  }
  const s = raw.settings;
  const name = text(s.radio_name, 80, 3);
  const tagline = text(s.tagline, 160);
  if (name === null || tagline === null || typeof s.show_poll !== "boolean"
    || typeof s.show_contact !== "boolean" || s.banner_interval_seconds !== 15) {
    throw new Error("Invalid app configuration");
  }
  const radio = {};
  for (const field of ["stream_url", "instagram_url", "youtube_url", "whatsapp_url", "facebook_url", "tiktok_url"]) {
    radio[field] = appPublicUrl(raw.radio[field]);
  }
  const email = raw.radio.contact_email;
  radio.contact_email = typeof email === "string" && email.length <= 320
    && /^[^\s@<>/?#&]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email) ? email : null;
  // Newlines are legitimate in the administrator's contact message.
  const contact = raw.radio.contact_text;
  radio.contact_text = typeof contact === "string" && contact.length <= 2000
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(contact) ? contact : "";
  const seen = new Set();
  const banners = [];
  for (const b of raw.banners) {
    if (!isRecord(b) || b.enabled !== true || !uuid.test(b.id || "") || seen.has(b.id)
      || !["top", "bottom"].includes(b.slot) || !integer(b.position) || b.position > 9999) continue;
    const image = appPublicUrl(b.image_url, true);
    const title = text(b.title, 120, 3);
    if (!image || title === null) continue;
    seen.add(b.id);
    banners.push({
      id: b.id, title, alt_text: text(b.alt_text, 240) ?? "", image_url: image,
      target_url: appPublicUrl(b.target_url), slot: b.slot, position: b.position, enabled: true,
    });
  }
  banners.sort((a, b) => Number(a.slot === "bottom") - Number(b.slot === "bottom") || a.position - b.position);
  return {
    settings: {
      radio_name: name, tagline, logo_url: appPublicUrl(s.logo_url, true),
      background_url: appPublicUrl(s.background_url, true), show_poll: s.show_poll,
      show_contact: s.show_contact, banner_interval_seconds: 15,
    },
    radio,
    banners,
  };
}

export function projectAppPoll(raw) {
  if (raw === null) return null;
  if (!isRecord(raw) || !uuid.test(raw.id || "") || !["active", "closed"].includes(raw.status)
    || text(raw.question, 180, 5) === null || !integer(raw.total)
    || !Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 6) {
    throw new Error("Invalid poll response");
  }
  if (raw.ends_at !== null && (typeof raw.ends_at !== "string" || !Number.isFinite(Date.parse(raw.ends_at)))) {
    throw new Error("Invalid poll response");
  }
  const seen = new Set();
  const options = raw.options.map((option) => {
    if (!isRecord(option) || !uuid.test(option.id || "") || seen.has(option.id)
      || text(option.label, 100, 1) === null || !integer(option.votes)) throw new Error("Invalid poll response");
    seen.add(option.id);
    return { id: option.id, label: option.label, votes: option.votes };
  });
  if (options.reduce((sum, option) => sum + option.votes, 0) !== raw.total) throw new Error("Invalid poll response");
  return { id: raw.id, question: raw.question, status: raw.status, ends_at: raw.ends_at, total: raw.total, options };
}

export async function fetchAppConfig(env = process.env, request = fetch) {
  const { url, key } = connection(env);
  async function rpc(name) {
    const response = await request(`${url}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: "{}", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("App provider unavailable");
    return response.json();
  }
  const [config, poll] = await Promise.allSettled([
    rpc("public_app_config").then(projectAppConfig),
    rpc("poll_results").then(projectAppPoll),
  ]);
  if (config.status !== "fulfilled") throw new Error("App configuration unavailable");
  return {
    schema_version: 1, ...config.value,
    poll: poll.status === "fulfilled" ? poll.value : null,
    poll_available: poll.status === "fulfilled",
  };
}
