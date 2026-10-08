import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function signature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function validCookie(value, secret) {
  const [id, sig] = String(value || "").split(".");
  return uuid.test(id) &&
    /^[0-9a-f]{64}$/.test(sig || "") &&
    timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(signature(`cookie:${id}`, secret)),
    )
    ? id
    : null;
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const send = (status, data) => res.status(status).json(data);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(405, { error: "Método inválido" });
  }
  const local =
    req.headers.host?.startsWith("127.0.0.1:") ||
    req.headers.host?.startsWith("localhost:");
  const expected = `${local ? "http" : "https"}://${req.headers.host}`;
  if (req.headers.origin !== expected)
    return send(403, { error: "Origem inválida" });
  const secret = process.env.POLL_WRITE_SECRET;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!secret || !url || !key)
    return send(503, { error: "Enquete temporariamente indisponível" });
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return send(400, { error: "Voto inválido" });
  }
  if (!uuid.test(body?.poll_id || "") || !uuid.test(body?.option_id || ""))
    return send(400, { error: "Escolha uma opção válida" });
  const name = local ? "deluxe-listener" : "__Host-deluxe-listener";
  const cookies = Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((c) => {
        const i = c.indexOf("=");
        return [c.slice(0, i).trim(), c.slice(i + 1)];
      }),
  );
  const id = validCookie(cookies[name], secret) || randomUUID();
  res.setHeader(
    "Set-Cookie",
    `${name}=${id}.${signature(`cookie:${id}`, secret)}; HttpOnly; ${local ? "" : "Secure; "}SameSite=Lax; Path=/; Max-Age=31536000`,
  );
  const ip = local
    ? req.socket?.remoteAddress || "local"
    : String(
        req.headers["x-vercel-forwarded-for"] ||
          req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "unknown",
      )
        .split(",")[0]
        .trim();
  try {
    const response = await fetch(`${url}/rest/v1/rpc/cast_listener_vote`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_poll: body.poll_id,
        p_option: body.option_id,
        p_voter: signature(`voter:${id}`, secret),
        p_ip: signature(`ip:${ip}`, secret),
        p_secret: secret,
      }),
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.message?.includes("Vote rate limit"))
        return send(429, {
          error: "Muitos votos nesta conexão. Tente mais tarde.",
        });
      if (data.message?.includes("Poll closed"))
        return send(409, {
          error: "Esta enquete foi encerrada. Atualize a página.",
        });
      return send(400, {
        error:
          "Não foi possível registrar seu voto. Atualize a página e tente novamente.",
      });
    }
    return send(200, data);
  } catch {
    return send(503, { error: "Não foi possível conectar. Tente novamente." });
  }
}
