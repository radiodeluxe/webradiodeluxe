import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { selectMusic } from "./selection.mjs";

const origins = new Set([
  "https://webradiodeluxe.vercel.app",
  "http://127.0.0.1:5173",
]);
const url = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const publicKeys = JSON.parse(
  Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}",
);
const service = createClient(
  url,
  secretKeys.default ||
    Object.values(secretKeys)[0] ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...(origins.has(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          Vary: "Origin",
          "Access-Control-Allow-Headers":
            "authorization, apikey, content-type, x-client-info",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        }
      : {}),
  };
  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (request.method === "OPTIONS")
    return origins.has(origin)
      ? new Response(null, { status: 204, headers })
      : respond({ error: "Forbidden" }, 403);
  if (request.method !== "POST")
    return respond({ error: "Method not allowed" }, 405);
  const credentials = await service.rpc("news_credentials");
  if (credentials.error || !credentials.data)
    return respond({ error: "Configuração indisponível" }, 503);
  const cron = request.headers.get("x-deluxe-cron");
  if (!cron || cron !== credentials.data.deluxe_cron_token) {
    const authorization = request.headers.get("authorization") || "";
    const client = createClient(
      url,
      publicKeys.default ||
        Object.values(publicKeys)[0] ||
        Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
      },
    );
    const {
      data: { user },
      error,
    } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    if (error || !user) return respond({ error: "Acesso restrito" }, 401);
    const access = await client.rpc("admin_access");
    if (access.error || access.data !== true)
      return respond({ error: "Acesso restrito" }, 403);
  }
  const claim = await service.rpc("claim_news_import");
  if (claim.error)
    return respond({ error: "Não foi possível iniciar a importação" }, 503);
  if (claim.data.skip)
    return respond({ message: claim.data.skip, published: 0 });
  const run = claim.data.run_id;
  let articles: unknown[] = [],
    message = "";
  try {
    const search = new URL("https://api.currentsapi.services/v1/search");
    search.searchParams.set("language", "pt");
    search.searchParams.set("keywords", "música");
    search.searchParams.set("page_size", "20");
    const response = await fetch(search, {
      headers: {
        Authorization: `Bearer ${credentials.data.deluxe_currents_key}`,
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok)
      throw new Error(`Currents retornou HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.status !== "ok" || !Array.isArray(payload.news))
      throw new Error("Resposta inválida da Currents");
    const existing = await service
      .from("news_posts")
      .select("source_url")
      .eq("origin", "currents");
    if (existing.error)
      throw new Error("Não foi possível verificar duplicatas");
    articles = selectMusic(
      payload.news,
      existing.data.map((p) => p.source_url),
      Date.now(),
    ).slice(0, claim.data.remaining);
    message = articles.length
      ? `${articles.length} chamada(s) de música em português selecionada(s).`
      : "Nenhuma notícia nova de música em português disponível. Nova tentativa no próximo horário.";
  } catch (error) {
    message =
      error instanceof Error &&
      /^(Currents retornou HTTP|Resposta inválida|Não foi possível verificar)/.test(
        error.message,
      )
        ? error.message
        : "Falha temporária ao consultar notícias. Nova tentativa no próximo horário.";
  }
  const finished = await service.rpc("finish_news_import", {
    p_run: run,
    p_articles: articles,
    p_message: message,
  });
  if (finished.error)
    return respond({ error: "Não foi possível concluir a importação" }, 503);
  return respond(
    { published: finished.data, message },
    articles.length ? 200 : 502,
  );
});
