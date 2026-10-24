# Revisão de SEO, GEO e preparação para AdSense

Data: 24 de outubro de 2026. Projeto JK HipHop, repositório `radiodeluxe/webradiodeluxe`.

## Escopo e evidências

Foram revisados o HTML público, o código da aplicação, os dados estruturados, a navegação, a origem das notícias, os anúncios, a configuração de publicação e as políticas oficiais do Google. A revisão técnica não representa aprovação do Google nem comprovação de licenças de conteúdo.

Antes da alteração, a resposta HTTP da home continha apenas o carregamento. Não havia canonical, Open Graph, JSON-LD, sitemap ou llms.txt. Os endereços institucionais não existiam: informações de contato e privacidade dependiam de modais. O painel só recebia noindex após carregar JavaScript.

## Correções implementadas

| Área | Resultado |
| --- | --- |
| Conteúdo público | HTML completo gerado no build e hidratado pelo React; apresentação da rádio e dos quatro programas disponível sem JavaScript. |
| Navegação | Links reais para Programação, Sobre, Contato, Privacidade, Termos e Política editorial, inclusive no rodapé. |
| Metadados | Título e descrição de cada página, canonical, OG/Twitter e imagem social. |
| Entidade | Organization, WebSite e WebPage em JSON-LD com nome JK HipHop, idioma e Instagram informado pelo proprietário. Sem notas, endereço, frequência FM, seguidores ou audiência inventados. |
| Descoberta | sitemap.xml, robots.txt e llms.txt gerados a partir das mesmas páginas e programas. |
| Área restrita | Documento próprio do painel, meta noindex e X-Robots-Tag; painel/API fora do sitemap. |
| URLs inexistentes | 404.html próprio, sem canonical da home; não há fallback global da aplicação. |
| Palavras e assuntos | Rádio online de rap, rap nacional e internacional, cultura hip-hop e clássicos dos anos 90 e 2000 presentes em texto útil, títulos e descrições. |
| Instagram | @radiojkhiphop com link direto, chamada na home e contatos das páginas institucionais. |
| Newsletter | Formulário público removido. Nenhum registro anterior foi apagado; a política permite solicitar informações/exclusão. |
| Notícias | Chamadas externas e seleção automática identificadas, fonte e link original preservados; sem marcar manchetes importadas como reportagens próprias em NewsArticle. |
| Publicidade | Banners identificados; links comerciais com rel=sponsored. Nenhum código de veiculação AdSense foi inserido. |

## Domínio e rastreamento

A API da Vercel confirmou o projeto `webradiodeluxe`, equipe `radiodeluxe`, e o endereço público `https://webradiodeluxe.vercel.app`. O domínio pretendido `radiojkhiphop.com` e seu www não resolveram DNS e não constavam nos domínios conectados na revisão. Por isso, canonical, sitemap e llms usam o endereço que de fato publica o site.

Após conectar e validar o domínio próprio, será necessário atualizar `SITE_URL`, ajustar o CORS da função de notícias, republicar e verificar redirects e canonicals. Não é recomendável apontar canonical para um domínio ainda indisponível.

O arquivo llms.txt fornece identidade, programas, referências e regras de atribuição. Ele não é requisito para aparecer nos recursos de IA do Google e não garante classificação. O Google aplica os fundamentos habituais de SEO também às respostas de IA. Referência: [recursos de IA e o site](https://developers.google.com/search/docs/appearance/ai-features).

O uso natural de palavras relevantes prioriza a compreensão do conteúdo. Uma meta tag de palavras-chave não substitui texto e navegação; o Google não a usa para classificação. Referência: [metadados aceitos pelo Google](https://developers.google.com/search/docs/crawling-indexing/special-tags).

## AdSense: estado e limites

Não havia script AdSense, identificador de editor ca-pub nem registro de vendedor ads.txt neste projeto. Nenhum identificador foi inventado ou copiado de outro site. Os espaços existentes são banners administrados pela própria rádio.

A principal limitação editorial é a agregação automática: as notícias importadas são chamadas de veículos externos, sem reportagem original ou revisão humana de cada artigo. O código preserva fonte, autor quando disponível e link; não copia artigo completo ou imagens das notícias. Identificar a fonte não torna esse material automaticamente elegível para monetização.

O Google restringe anúncios em telas de conteúdo replicado sem valor adicional e em conteúdo de baixo valor ou gerado automaticamente sem revisão/curadoria. As páginas institucionais e as apresentações próprias melhoram transparência e utilidade, mas não comprovam elegibilidade de futuras páginas de notícias. Referências: [conteúdo replicado](https://support.google.com/publisherpolicies/answer/11190248?hl=pt-BR) e [telas sem conteúdo do editor](https://support.google.com/publisherpolicies/answer/11112688?hl=pt-BR).

Antes de integrar anúncios Google, a avaliação deve considerar conteúdo próprio de valor, revisão editorial do inventário monetizado, identificação do editor, direitos dos materiais e da execução musical, privacidade e os requisitos de consentimento aplicáveis à configuração de anúncios. A documentação de políticas não permite certificar aprovação apenas olhando o código. Referência: [políticas para editores](https://support.google.com/adsense/answer/10502938?hl=pt-BR).

| Sistema ou comprovação | Estado nesta revisão |
| --- | --- |
| Search Console: indexação, propriedade e cobertura | SEM ACESSO; nenhuma indexação ou posição foi comprovada. |
| AdSense: conta, domínio aprovado e análise do Google | SEM ACESSO; aprovação e veiculação não comprovadas. |
| Direitos de execução musical e materiais externos enviados pelo administrador | Documentação não fornecida; não certificada pela revisão de código. |
| Fatos de cada notícia do veículo de origem | Não houve checagem humana individual de todas as publicações. |

## Como reproduzir os testes técnicos

```sh
npm run build
npm run verify:seo
npm run test:server
npm test -- --workers=4
npm run preview -- --port 4173
```

O verificador inspeciona os documentos HTML sem executar JavaScript, metadados únicos, idioma, H1, nomes e descrições dos programas, JSON-LD seguro, canonical, sitemap, robots, llms, painel e 404. Os testes de navegador cobrem interação, player fixo, comportamento responsivo, enquete e banners; os envios de teste são interceptados.

## Validação realizada

- Build de produção e `verify:seo`: aprovados para as sete páginas públicas.
- Playwright contra a versão compilada (`BASE_URL=http://127.0.0.1:4174`): 20 testes aprovados, incluindo as seis páginas institucionais e os sete aliases `index.html`, sem erros de hidratação.
- Testes de servidor: três aprovados, cobrindo filtragem de notícias e proteções da API de enquete.
- Preview: aliases públicos retornam HTTP 308 para a URL canônica, preservando a query; URLs desconhecidas retornam HTTP 404.
- Inspeção visual em desktop e celular: descrições dos quatro programas, chamada do Instagram e navegação institucional sem transbordamento horizontal.
- O build mantém um aviso de bundle principal de aproximadamente 510 kB, sem impedir a compilação.

Na publicação, conferir respostas HTTP das páginas, sitemap/robots/llms, cabeçalho noindex do painel e status 404 de uma URL inexistente. No navegador, conferir hidratação sem erros e navegação para as páginas institucionais. Esses resultados técnicos não substituem a análise de Search Console ou AdSense.
