import { fetchAppConfig } from "../server/app-config.mjs";

export function createAppHandler({ env = process.env, request = fetch } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: "Método inválido" }));
    }
    try {
      const data = await fetchAppConfig(env, request);
      res.statusCode = 200;
      return res.end(req.method === "HEAD" ? undefined : JSON.stringify(data));
    } catch {
      res.statusCode = 503;
      res.setHeader("Retry-After", "30");
      return res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "Aplicativo temporariamente indisponível. Tente novamente em instantes." }));
    }
  };
}

export default createAppHandler();
