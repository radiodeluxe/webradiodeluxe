export const SITE_URL = "https://webradiodeluxe.vercel.app";
export const INSTAGRAM_URL = "https://www.instagram.com/radiojkhiphop/";

export const publicPaths = [
  "/",
  "/programacao",
  "/sobre",
  "/contato",
  "/privacidade",
  "/termos",
  "/editorial",
];

const pages: Record<string, { title: string; description: string }> = {
  "/": {
    title: "JK HipHop | Rádio online de rap nacional e internacional",
    description:
      "Ouça a JK HipHop: rádio online de rap nacional e internacional. Conheça Clássicos do Rap, NoBreack Hip-Hop, Pediu! Tocou e Resenha Hip-Hop.",
  },
  "/programacao": {
    title: "Programação de rap e hip-hop | JK HipHop",
    description:
      "Conheça os programas da JK HipHop: Clássicos do Rap, NoBreack Hip-Hop, Pediu! Tocou e Resenha Hip-Hop. Música, pedidos dos ouvintes e boa conversa.",
  },
  "/sobre": {
    title: "Sobre a JK HipHop | Rap, música e cultura hip-hop",
    description:
      "Conheça a proposta da JK HipHop, uma web rádio dedicada ao rap nacional e internacional, aos clássicos e à conexão com quem vive a cultura hip-hop.",
  },
  "/contato": {
    title: "Contato, pedidos de música e parcerias | JK HipHop",
    description:
      "Fale com a JK HipHop pelo Instagram @radiojkhiphop. Envie pedidos de música, sugestões, propostas de parceria ou solicitações de correção de conteúdo.",
  },
  "/privacidade": {
    title: "Política de Privacidade | JK HipHop",
    description:
      "Saiba como a JK HipHop trata dados de navegação, votos da enquete e acesso administrativo, quais serviços utiliza e como solicitar informações.",
  },
  "/termos": {
    title: "Termos de uso e direitos autorais | JK HipHop",
    description:
      "Conheça as condições de uso da rádio online JK HipHop, as regras de participação, os direitos sobre o conteúdo e os cuidados com links externos.",
  },
  "/editorial": {
    title: "Política editorial, fontes e publicidade | JK HipHop",
    description:
      "Entenda a seleção de manchetes da JK HipHop, a identificação das fontes, o uso de imagens ilustrativas, os pedidos de correção e a publicidade.",
  },
};

export type PageSeo = {
  title: string;
  description: string;
  robots: string;
  canonical?: string;
  structuredData: { "@context": string; "@graph": Record<string, unknown>[] };
};

function normalizePath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0] || "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function getPageSeo(path: string): PageSeo {
  const pathname = normalizePath(path);
  const page = pages[pathname];
  if (!page) {
    const admin = /^\/admin(?:\/|$)/.test(pathname);
    return {
      title: admin
        ? "Admin Master | JK HipHop"
        : "Página não encontrada | JK HipHop",
      description: admin
        ? "Acesso administrativo restrito da JK HipHop."
        : "Esta página não foi encontrada. Acesse a JK HipHop para ouvir a rádio e conhecer a programação.",
      robots: "noindex, nofollow",
      structuredData: { "@context": "https://schema.org", "@graph": [] },
    };
  }

  const canonical = `${SITE_URL}${pathname}`;
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;
  return {
    ...page,
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    canonical,
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": organizationId,
          name: "JK HipHop",
          alternateName: "Web Rádio JK HipHop",
          url: `${SITE_URL}/`,
          description:
            "Web rádio de rap nacional e internacional e cultura hip-hop em português.",
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/favicon.svg`,
            width: 144,
            height: 144,
          },
          sameAs: [INSTAGRAM_URL],
        },
        {
          "@type": "WebSite",
          "@id": websiteId,
          url: `${SITE_URL}/`,
          name: "JK HipHop",
          inLanguage: "pt-BR",
          publisher: { "@id": organizationId },
        },
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: page.title,
          description: page.description,
          inLanguage: "pt-BR",
          isPartOf: { "@id": websiteId },
          about: { "@id": organizationId },
        },
      ],
    },
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export function renderSeoHead(path: string) {
  const seo = getPageSeo(path);
  const meta = (name: string, value: string, property = false) =>
    `<meta ${property ? "property" : "name"}="${escapeHtml(name)}" content="${escapeHtml(value)}" />`;
  const tags = [
    `<title>${escapeHtml(seo.title)}</title>`,
    meta("description", seo.description),
    meta("robots", seo.robots),
  ];
  if (!seo.canonical) return tags.join("\n");
  tags.push(
    `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`,
    meta("og:type", "website", true),
    meta("og:site_name", "JK HipHop", true),
    meta("og:locale", "pt_BR", true),
    meta("og:title", seo.title, true),
    meta("og:description", seo.description, true),
    meta("og:url", seo.canonical, true),
    meta("og:image", `${SITE_URL}/images/hero.webp`, true),
    meta(
      "og:image:alt",
      "Arte ilustrativa da rádio JK HipHop em um estúdio de rap",
      true,
    ),
    meta("twitter:card", "summary_large_image"),
    meta("twitter:title", seo.title),
    meta("twitter:description", seo.description),
    meta("twitter:image", `${SITE_URL}/images/hero.webp`),
    meta(
      "twitter:image:alt",
      "Arte ilustrativa da rádio JK HipHop em um estúdio de rap",
    ),
  );
  const json = JSON.stringify(seo.structuredData)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  tags.push(`<script type="application/ld+json">${json}</script>`);
  return tags.join("\n");
}
