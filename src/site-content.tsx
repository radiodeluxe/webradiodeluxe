import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { programs, playlists } from "./content";
import { safeUrl, supabase, type RadioSettings } from "./lib";
import { INSTAGRAM_URL, renderSeoHead } from "./seo";

export type ContentItem = {
  id: string;
  kind: "program" | "playlist" | "team" | "gallery";
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  time_label: string;
  days_label: string;
  position: number;
  enabled: boolean;
};
export type SiteContent = { items: ContentItem[]; settings: RadioSettings };
export const defaultSiteContent: SiteContent = {
  settings: {
    stream_url: null, instagram_url: INSTAGRAM_URL, youtube_url: null,
    contact_email: null, contact_text: null, whatsapp_url: null,
    facebook_url: null, tiktok_url: null,
  },
  items: [
    ...programs.map((item, position): ContentItem => ({
      id: `program-${position}`, kind: "program", title: item.title,
      description: item.description, image_url: `/images/${item.image}.webp`,
      time_label: item.time, days_label: item.days, link_url: null,
      position, enabled: true,
    })),
    ...playlists.map((item, position): ContentItem => ({
      id: `playlist-${position}`, kind: "playlist", title: item.title,
      description: item.subtitle, image_url: `/images/${item.image}.webp`,
      time_label: "", days_label: "",
      link_url: null,
      position, enabled: true,
    })),
    ...["rapper", "crowd", "city", "vinyl", "battle", "hero"].map((image, position): ContentItem => ({
      id: `gallery-${position}`, kind: "gallery", title: "Universo visual JK HipHop",
      description: "Imagem conceitual criada com inteligência artificial. Não é registro de evento ou integrante da rádio.",
      image_url: `/images/${image}.webp`, link_url: null, time_label: "", days_label: "",
      position, enabled: true,
    })),
  ],
};

export function instagramDetails(value: string | null | undefined) {
  const url = safeUrl(value);
  if (!url) return { url: null, handle: "Instagram" };
  const parsed = new URL(url);
  const name = parsed.pathname.split("/").filter(Boolean)[0];
  return { url, handle: /(^|\.)instagram\.com$/i.test(parsed.hostname) && name ? `@${name}` : "Instagram" };
}

// Whitelist the public payload. Neither admin-only rows nor extra settings can
// accidentally enter the HTML snapshot or the browser through this boundary.
export function normalizeSiteContent(value: unknown): SiteContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.items) || !raw.settings || typeof raw.settings !== "object" || Array.isArray(raw.settings)) return null;
  const source = raw.settings as Record<string, unknown>;
  const settings = {} as RadioSettings;
  for (const key of Object.keys(defaultSiteContent.settings) as (keyof RadioSettings)[]) {
    const entry = source[key];
    settings[key] = typeof entry === "string" ? (key.endsWith("_url") ? safeUrl(entry) : entry) : null;
  }
  const items: ContentItem[] = [];
  for (const entry of raw.items) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    if (item.enabled !== true || !["program", "playlist", "team", "gallery"].includes(String(item.kind)) || typeof item.id !== "string" || typeof item.title !== "string") continue;
    const image = typeof item.image_url === "string" && /^\/images\/[a-z0-9_-]+\.webp$/i.test(item.image_url)
      ? item.image_url : safeUrl(typeof item.image_url === "string" ? item.image_url : null);
    items.push({
      id: item.id, kind: item.kind as ContentItem["kind"], title: item.title,
      description: typeof item.description === "string" ? item.description : "",
      image_url: image, link_url: safeUrl(typeof item.link_url === "string" ? item.link_url : null),
      time_label: typeof item.time_label === "string" ? item.time_label : "",
      days_label: typeof item.days_label === "string" ? item.days_label : "",
      position: typeof item.position === "number" ? item.position : 0, enabled: true,
    });
  }
  items.sort((a, b) => a.position - b.position);
  return { items, settings };
}

const ContentContext = createContext<SiteContent>(defaultSiteContent);
export const useSiteContent = () => useContext(ContentContext);

export function SiteContentProvider({ initial = defaultSiteContent, children }: { initial?: SiteContent; children: ReactNode }) {
  const [content, setContent] = useState(initial);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let mounted = true;
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const { data, error } = await client.rpc("public_site_content");
        const next = !error && normalizeSiteContent(data);
        if (mounted && next) setContent(next);
      } catch { /* Keep the last public snapshot until the next retry. */ }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted = false; window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    const head = new DOMParser().parseFromString(renderSeoHead(path, content), "text/html").head;
    document.head.querySelectorAll('title, meta[name="description"], meta[name="robots"], link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], script[type="application/ld+json"]').forEach(node => node.remove());
    document.head.append(...Array.from(head.children));
  }, [content]);
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}
