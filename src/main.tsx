import React, { lazy, Suspense } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import SitePage from "./SitePages";
import { publicPaths, renderSeoHead } from "./seo";
import "./styles.css";
import "./motion.css";
import { LoadingState } from "./Motion";
import { SiteContentProvider, defaultSiteContent, normalizeSiteContent } from "./site-content";

const Admin = lazy(() => import("./Admin"));
const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const indexAlias = pathname.endsWith("/index.html")
  ? pathname.slice(0, -"/index.html".length) || "/"
  : pathname;
const path = publicPaths.includes(indexAlias) ? indexAlias : pathname;
const adminRoute = /^\/admin(?:\/|$)/.test(path);
const root = document.getElementById("root")!;
let initialContent = defaultSiteContent;
try {
  const payload = document.getElementById("site-content")?.textContent;
  if (payload) initialContent = normalizeSiteContent(JSON.parse(payload)) || defaultSiteContent;
} catch { /* A damaged payload is recovered through the public RPC. */ }
const app = (
  <React.StrictMode>
    {adminRoute ? (
      <Suspense fallback={<LoadingState fullscreen label="Carregando painel…" />}>
        <Admin />
      </Suspense>
    ) : <SiteContentProvider initial={initialContent}>{path === "/" ? <App /> : <SitePage path={path} />}</SiteContentProvider>}
  </React.StrictMode>
);

if (root.dataset.prerender === "true" && !adminRoute) {
  hydrateRoot(root, app);
} else {
  // Development uses the same metadata as the static production pages.
  const head = new DOMParser().parseFromString(renderSeoHead(path), "text/html").head;
  document.head.querySelectorAll('title, meta[name="description"], meta[name="robots"], link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], script[type="application/ld+json"]').forEach(node => node.remove());
  document.head.append(...Array.from(head.children));
  createRoot(root).render(app);
}
