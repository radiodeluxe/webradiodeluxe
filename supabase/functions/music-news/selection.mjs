export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)
    )
      return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch {
    return null;
  }
}
export function selectMusic(news, existing = [], now = Date.now()) {
  const seen = new Set(existing.map(canonicalUrl).filter(Boolean));
  const terms =
    /\b(musica|musical|musicais|rapper|rap|hip hop|hip-hop|trap|album|albuns|cantor|cantora|cantores|banda|single|show|shows|festival|festivais|discografia|rock|samba|funk|sertanejo|pagode)\b/;
  return news
    .map((item) => ({
      ...item,
      time: Date.parse(
        String(item.published)
          .replace(/ (\d{2}:\d{2}:\d{2}) /, "T$1")
          .replace(/([+-]\d{2})(\d{2})$/, "$1:$2"),
      ),
    }))
    .filter(
      (item) =>
        item.language === "pt" &&
        typeof item.title === "string" &&
        item.title.trim().length >= 3 &&
        Number.isFinite(item.time) &&
        item.time <= now + 300000 &&
        item.time >= now - 7 * 86400000 &&
        terms.test(
          `${item.title} ${item.description || ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        ),
    )
    .sort((a, b) => b.time - a.time)
    .flatMap((item) => {
      const url = canonicalUrl(item.url);
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [
        {
          title: item.title.trim().slice(0, 240),
          url,
          source: new URL(url).hostname.replace(/^www\./, ""),
          author:
            typeof item.author === "string" ? item.author.slice(0, 160) : null,
          published: new Date(item.time).toISOString(),
        },
      ];
    });
}
