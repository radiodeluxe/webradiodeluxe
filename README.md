# JK HipHop — Web Rádio

Site React + TypeScript + Vite da JK HipHop, com painel exclusivo do administrador master, Supabase e publicação na Vercel. A identidade usa `public/logo-jk-hiphop.svg`, com monograma compacto em `public/jk-monogram.svg` e favicon correspondente. Os identificadores técnicos existentes de hospedagem, autenticação e banco são preservados.

- Site: https://webradiodeluxe.vercel.app
- Painel: https://webradiodeluxe.vercel.app/admin
- GitHub: https://github.com/radiodeluxe/webradiodeluxe

## Executar e verificar

Requer Node 22.12+ ou 24, npm e Chrome para os testes de navegador.

```sh
npm ci
cp .env.example .env.local
# Preencher a URL e a chave publishable do Supabase.
# POLL_WRITE_SECRET deve corresponder ao segredo da enquete no Vault.
npm run dev
npm run build
npm run test:server
npm test
```

`BASE_URL` permite testar uma publicação. Os testes de navegador interceptam votos e inscrições; os testes SQL em `supabase/tests/` usam transações com rollback. `news-quota.sql` pressupõe três publicações já realizadas no dia e execução após 9h em Brasília. Nunca guardar credenciais em testes ou no Git.

## Funcionalidades

- Layout preto e amarelo responsivo, carrossel, busca, programação, playlists, galeria e espaços publicitários.
- Player fixo abaixo do cabeçalho, com uma única instância de áudio, pausa, volume, compartilhamento e tela cheia quando disponível.
- Transições entre telas e janelas, carregamento com equalizador e zoom dos blocos ao entrar na tela. Respeita `prefers-reduced-motion`, revela conteúdo ao focar pelo teclado e mantém o player fora das animações de rolagem.
- Gestão de banners no master: três espaços (aplicativo/topo, publicidade superior e principal), upload de JPG/PNG/WebP/GIF até 5 MB ou URL HTTPS, prévia, link, descrição acessível, ativação e restauração da chamada original. Mudanças aparecem ao abrir o site ou na próxima atualização de 60 segundos.
- Notícias reais da Currents API em português, com categoria, autor/fonte, data e link original. Publicações manuais admitem conteúdo próprio e imagem HTTPS.
- Enquete pública sem cadastro: opções, porcentagens, total de votos e confirmação de envio. Uma enquete ativa por vez.
- Newsletter com consentimento e lista privada para o master.
- Painel `/admin`: dashboard com dados reais, notícias/rascunhos/arquivamento, automação e histórico, gestão de enquetes, transmissão, contato/redes, newsletter e alteração da própria senha.

A programação e as playlists permanecem como propostas demonstrativas da primeira etapa. O streaming ainda não foi informado e pode ser configurado em **Player / transmissão**. Aplicativos e equipe aguardam dados oficiais. O painel não apresenta estatísticas inventadas de audiência. Envio de campanhas não está implementado.

## Autenticação e permissões

Conta master provisionada para o e-mail solicitado pelo proprietário. A senha não aparece no código, migrações ou variáveis do frontend. Não há formulário de cadastro ou contas públicas.

A autorização é verificada por `admin_access()` e pelas políticas RLS: exige vínculo em `private.admin_users` e uma sessão existente em `auth.sessions`. Uma sessão revogada perde permissão mesmo que seu JWT ainda não tenha expirado. O painel guarda a sessão em `sessionStorage`, valida acesso ao entrar/recarregar/focar e encerra a sessão no logout. O frontend público usa um cliente separado, sem persistência de autenticação.

A criação de novas contas está bloqueada por trigger em `auth.users`. A função temporária usada para provisionar o master foi encerrada (HTTP 410 e verificação JWT ativada). Não executar provisionamento novamente. Não conceder acesso apenas por comparação de e-mail no frontend.

Projeto Supabase: `qsbklzaovqshsznlvurg` (Rádio Web Deluxe). Migrações em `supabase/migrations/` já aplicadas; não reaplicar as mesmas migrações manualmente. O provisionamento temporário ocorreu entre migrações; a migração seguinte bloqueia todas as novas inserções.

Tabelas públicas usam RLS. Visitantes leem configuração e notícias publicadas, inserem newsletter com consentimento e consultam resultados agregados de enquete. Não leem inscritos, rascunhos, configuração da automação ou votos individuais. Escritas editoriais/configurações exigem master.

## Notícias automáticas

A função Supabase `music-news` consulta `/v1/search` da Currents com `language=pt`, `keywords=música` e `page_size=20` (limite confirmado do plano Free desta conta). A seleção exclui idioma incorreto, notícias antigas/futuras, URLs inseguras e duplicatas; preserva fonte e autor. Nenhum artigo completo ou imagem de terceiros é copiado. Chamadas automáticas expiram em sete dias, com crédito e link para a fonte; conteúdo original manual permanece até ser arquivado.

`pg_cron` agenda **9h, 15h e 21h, America/Sao_Paulo**, com nova tentativa às 10h, 16h e 22h. A cota progride para uma, duas e três publicações conforme o horário. A contagem usa o histórico: remover/arquivar uma notícia não libera uma quarta vaga. Um lock com prazo impede importações concorrentes. Pausar a automação impede novas publicações. **Buscar agora** segue a mesma cota.

As três primeiras chamadas foram importadas com a API real. A meta diária depende de notícias elegíveis disponíveis e do funcionamento da API; falhas ficam no histórico e não geram artigos fictícios.

Credenciais criptografadas no Supabase Vault:

- `deluxe_currents_key`: chave Currents.
- `deluxe_cron_token`: autenticação dos agendamentos.
- `deluxe_poll_secret`: escrita pelo servidor de votos.
- `deluxe_project_url`: URL do projeto Supabase.

`news_credentials`, `claim_news_import` e `finish_news_import` são executáveis somente pelo serviço. `music-news` verifica um token secreto de cron ou um JWT válido com autorização master. `verify_jwt=false` permite o cron e as novas chaves publishable; a autenticação é implementada dentro da função. Configuração em `supabase/config.toml`.

## Enquete

`/api/poll` é uma função Node da Vercel. Aceita POST da mesma origem, valida IDs e emite cookie assinado HttpOnly/Secure/SameSite. Deriva identificadores HMAC para navegador e conexão. `cast_listener_vote` verifica o segredo do Vault, enquete/opção, duplicação e limite de 20 votos por conexão/hora antes de gravar. IP em texto aberto não é armazenado.

Uma restrição única por enquete/identificador evita votos repetidos no mesmo navegador; não verifica identidade pessoal, e limpar cookies/trocar navegador pode contornar a identificação. Opções ficam imutáveis após o primeiro voto. Encerrar ou ativar outra enquete preserva resultados. A interface pública recebe apenas totais agregados.

O middleware do Vite atende a mesma API em desenvolvimento. `POLL_WRITE_SECRET` é exclusivamente do servidor e deve corresponder a `deluxe_poll_secret` no Vault. Nunca usar prefixo `VITE_` para segredos.

## Banners

`ad_banners` possui três posições fixas. Visitantes leem apenas espaços ativos; somente o master com sessão válida altera os dados. O bucket público `deluxe-banners` aceita imagens até 5 MB: arquivos são visíveis por URL, mas envio, listagem e remoção exigem master. Cada upload usa nome único para evitar sobrescritas e cache antigo. Remover a imagem do banner restaura a chamada original da JK HipHop; arquivos anteriores permanecem no bucket, preservando referências existentes. Se a gravação falhar após um upload, o arquivo recém-enviado é removido.

Dimensões recomendadas: 728 × 90 px nos dois espaços superiores e 1000 × 140 px no principal. Imagens se ajustam sem cortes. Desativar um espaço o oculta, incluindo a chamada original. Uma imagem externa indisponível usa a chamada original como alternativa. A migração `banner_management` já foi aplicada ao projeto Deluxe.

## Publicação

Vercel: conta `admmovimentodf@gmail.com`, equipe `radiodeluxe`, projeto `webradiodeluxe`, produção `main`, build `npm run build`, saída `dist`. A integração GitHub dispara builds após o push. O domínio principal é público; previews/URLs de deploy mantêm proteção da Vercel.

Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `POLL_WRITE_SECRET` nos ambientes development/preview/production. A chave Currents fica somente no Vault. `.env.local`, `.vercel`, `artifacts/`, sessões, dependências e relatórios de QA ficam fora do Git.

Ao trocar de projeto Supabase, atualizar variáveis, Vault e agendamentos. Não usar chaves `service_role`/`sb_secret_` no frontend. A URL do streaming pode ser alterada sem build pelo painel; a página pública consulta a configuração ao carregar.

## Imagens e fontes

Imagens conceituais próprias em `public/images/`, com proveniência em `ASSETS.md`. Não representam artistas ou eventos reais. Fotos externas só são usadas quando o master fornece uma URL própria. As fontes são Google Fonts. A política de privacidade no site descreve newsletter, enquete e provedores.
