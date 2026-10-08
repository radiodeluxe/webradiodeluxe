# Web Rádio Deluxe

Primeira versão do site da Deluxe, construída a partir da referência visual fornecida. React, TypeScript e Vite; hospedagem Vercel e configuração pública/cadastros no Supabase.

## Executar

Requer Node.js 22.12+ ou 24 e npm.

```sh
npm ci
cp .env.example .env.local
# Configure as variáveis públicas do projeto Supabase.
npm run dev
npm run build
```

Para verificar os fluxos, instale o Google Chrome e execute `npm test`. Para testar um deploy, defina `BASE_URL` com a URL publicada antes de executar os testes. Os testes do formulário interceptam suas requisições e não gravam cadastros de QA no banco.

## O que esta versão entrega

- Layout responsivo em preto e amarelo, marca tipográfica provisória, imagens próprias e favicon.
- Menu móvel, carrossel de destaques, busca, programação, seleções musicais, área editorial, galeria e anúncios.
- Player HTML audio com volume, pausa, compartilhamento e tela cheia quando disponível.
- Cadastro de novidades com consentimento, validação, estados de envio/erro e armazenamento no Supabase.
- Política de privacidade e comportamento com movimento reduzido.

A transmissão ainda não tem URL: o player informa que está em configuração e não simula reprodução. Programação e textos editoriais são demonstrações identificadas; aplicativos, redes sociais, equipe e contato aguardam definições oficiais. Os links das seleções abrem buscas reais no YouTube; playlists oficiais serão configuradas depois. Não há painel administrativo, disparo de campanhas ou contas administrativas nesta etapa.

## Supabase

Projeto: `qsbklzaovqshsznlvurg` (Rádio Web Deluxe). As migrações versionadas em `supabase/migrations/` foram aplicadas ao projeto. Não reaplique manualmente migrações já registradas.

- `radio_settings`: uma linha (`id = 1`), leitura pública, escrita restrita à administração do banco. Guarda URL HTTPS da transmissão, Instagram, YouTube e e-mail de contato; valores começam vazios. O futuro painel precisará implementar autenticação e autorização administrativa antes de permitir escrita.
- `newsletter_subscribers`: cadastro público apenas das colunas `email` e `consent`; leitura, edição e exclusão negadas a visitantes e usuários comuns. Consentimento obrigatório, e-mail normalizado e único.
- `public.rls_auto_enable()`: função de evento já existente no projeto. Revogada sua execução para `PUBLIC`, `anon` e `authenticated`.

O frontend recebe somente a URL e a chave **publishable**. Nunca configure chave `service_role` ou `sb_secret_` em variáveis `VITE_*`.

O teste `supabase/tests/privacy.sql` verifica permissões dentro de uma transação que é revertida; nenhum cadastro de teste fica no banco. A inscrição pública é uma base inicial: antes de divulgar campanhas em escala, implementar confirmação de e-mail, antispam no servidor e descadastro. O envio de campanhas está desativado.

## Publicação

Repositório: https://github.com/radiodeluxe/webradiodeluxe

Vercel: projeto `webradiodeluxe`, equipe `radiodeluxe`, branch de produção `main`, comando `npm run build`, saída `dist`. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` estão configuradas na Vercel. `.env.local`, `.vercel`, artefatos de QA e dependências ficam fora do Git.

Quando houver transmissão, preencher `radio_settings.stream_url` no Supabase com uma URL HTTPS de áudio compatível com o navegador. A página consulta essa configuração ao carregar. `VITE_RADIO_STREAM_URL` é um fallback opcional que exige novo build. Testar o endereço real, o formato e a reprodução em desktop/iOS/Android antes de anunciar a rádio como ao vivo.

## Imagens

As imagens conceituais foram geradas com a ferramenta imagegen para este layout, convertidas para WebP e salvas em `public/images/`. Não representam artistas, equipe ou eventos reais. Briefings e proveniência estão em `ASSETS.md`.
