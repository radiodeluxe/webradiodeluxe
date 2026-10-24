import { renderToString } from "react-dom/server";
import App from "./App";
import SitePage from "./SitePages";
import { LoadingState } from "./Motion";
import { programs } from "./content";
import { SiteContentProvider, defaultSiteContent, normalizeSiteContent, type SiteContent } from "./site-content";
import {
  getPageSeo,
  INSTAGRAM_URL,
  publicPaths,
  renderSeoHead,
  SITE_URL,
} from "./seo";

export { getPageSeo, INSTAGRAM_URL, programs, publicPaths, SITE_URL };
export { defaultSiteContent, normalizeSiteContent };

// Render the same public snapshot into HTML and the hydration payload.
// The invoker RPC and its RLS expose only published content.
export function render(path: string, snapshot: SiteContent = defaultSiteContent) {
  const isAdmin = /^\/admin(?:\/|$)/.test(path);
  const content = isAdmin ? (
    <LoadingState fullscreen label="Carregando painel…" />
  ) : path === "/" ? (
    <App />
  ) : (
    <SitePage path={path} />
  );

  return {
    html: renderToString(isAdmin ? content : <SiteContentProvider initial={snapshot}>{content}</SiteContentProvider>),
    head: renderSeoHead(path, snapshot),
    prerendered: !isAdmin,
  };
}
