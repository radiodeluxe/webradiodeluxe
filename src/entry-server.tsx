import { renderToString } from "react-dom/server";
import App from "./App";
import SitePage from "./SitePages";
import { LoadingState } from "./Motion";
import { programs } from "./content";
import {
  getPageSeo,
  INSTAGRAM_URL,
  publicPaths,
  renderSeoHead,
  SITE_URL,
} from "./seo";

export { getPageSeo, INSTAGRAM_URL, programs, publicPaths, SITE_URL };

// Render only local, owned content at build time. Supabase data remains live
// on the client; no credentials or private/admin content enter static HTML.
export function render(path: string) {
  const isAdmin = /^\/admin(?:\/|$)/.test(path);
  const content = isAdmin ? (
    <LoadingState fullscreen label="Carregando painel…" />
  ) : path === "/" ? (
    <App />
  ) : (
    <SitePage path={path} />
  );

  return {
    html: renderToString(content),
    head: renderSeoHead(path),
    prerendered: !isAdmin,
  };
}
