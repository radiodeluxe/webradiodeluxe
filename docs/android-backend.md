# Configuração pública do aplicativo Android

Migração aplicada: `20261025130326_android_app_management.sql`.

O aplicativo não possui cadastro nem login administrativo. O master usa o
painel do site; a autorização das gravações é conferida no banco por
`private.is_master()`, que exige um usuário provisionado e uma sessão ainda
presente em `auth.sessions`.

## Dados administráveis

- `public.app_settings`, singleton `id=1`: `radio_name` (3–80 caracteres),
  `tagline` (até 160), `logo_url`, `background_url`, `show_poll`, `show_contact`.
  As imagens nulas mantêm o visual incluído no APK. A rotação é fixada em
  `banner_interval_seconds=15`; clientes não podem alterar o intervalo, o ID
  ou o timestamp. O master pode atualizar a configuração, sem criar ou apagar
  a linha singleton.
- `public.app_banners`: `title` (3–120 caracteres), `alt_text` (até 240),
  `image_url`, `target_url`, `slot` (`top` ou `bottom`), `position` (0–9999) e
  `enabled`. IDs e timestamps são gerados no banco. Rascunhos podem ficar sem
  imagem; um banner habilitado exige imagem. Nenhum anunciante de exemplo é
  cadastrado.
- Transmissão, redes sociais e contato usam os mesmos oito campos públicos
  existentes em `radio_settings`. A enquete usa o módulo existente do site.

URLs de imagem aceitam HTTPS sem espaços, com até 4096 caracteres, ou os
caminhos locais `/images/[a-z0-9][a-z0-9_-]*.webp`. Links de destino aceitam
somente HTTPS. Um caminho local deve ser resolvido contra o endereço do site.

## Leitura pelo servidor do aplicativo

`POST /rest/v1/rpc/public_app_config` com corpo `{}` e chave pública retorna:

```json
{
  "settings": {
    "radio_name": "JK HipHop",
    "tagline": "O rap em alto nível.",
    "logo_url": null,
    "background_url": null,
    "show_poll": true,
    "show_contact": true,
    "banner_interval_seconds": 15,
    "updated_at": "timestamp"
  },
  "radio": {
    "stream_url": null,
    "instagram_url": "https://www.instagram.com/radiojkhiphop/",
    "youtube_url": null,
    "contact_email": null,
    "contact_text": "",
    "whatsapp_url": null,
    "facebook_url": null,
    "tiktok_url": null
  },
  "banners": []
}
```

A função usa `SECURITY INVOKER`, com RLS, e lista explicitamente os campos
públicos. `banners` contém apenas anúncios habilitados, ordenados por slot,
posição, criação e ID. Os itens incluem `id`, `title`, `alt_text`, `image_url`,
`target_url`, `slot`, `position`, `enabled`, `created_at` e `updated_at`.
O APK pode consumir a API pública do site, que encapsula esse RPC; nenhuma
chave administrativa ou segredo de votação deve entrar no pacote Android.

## Imagens

Bucket público `deluxe-app`: JPEG, PNG, WebP e GIF, até 5 MB. O upload usa
`branding/<uuid>.<ext>` ou `banner/<uuid>.<ext>`. Somente o master com sessão
ativa pode listar, enviar, substituir ou remover arquivos. SVG e nomes ou
pastas fora desse padrão são rejeitados. As URLs dos arquivos são públicas,
inclusive quando uma imagem é usada apenas em um rascunho; não envie arquivos
confidenciais. A remoção de arquivos deve usar a API Storage, não SQL direto.

## Enquete existente

`poll_results(p_id uuid default null)` retorna a enquete ativa ou `null`:
`{id,question,status,ends_at,total,options:[{id,label,votes}]}`.
O voto usa `POST /api/poll`, com `{poll_id,option_id}`, `Origin` do site e o
cookie persistente do ouvinte. A resposta é `{already_voted,results}`. O segredo
de gravação permanece exclusivamente no servidor; o aplicativo não deve chamar
`cast_listener_vote` diretamente. As proteções de sessão, voto repetido e limite
de conexão do site continuam em vigor.

## Verificação executada

`supabase/tests/android-app.sql` foi executado no projeto real, antes e depois
da aplicação da migração, em transação com rollback. Verifica CRUD dos dois
slots pelo master, configuração, publicação, privacidade de rascunhos, bloqueio
de anônimo/não master/sessão revogada, colunas protegidas, restrições de URLs e
metadados Storage de upload e atualização. Nenhum dado de QA permanece salvo.
O teste de metadados não transfere bytes de imagem.

O RPC também foi consultado pela API REST pública: HTTP 200, oito campos de
configuração, oito de rádio e zero banners iniciais. Tentativas de criar banner
e editar configuração com a chave pública anônima retornaram HTTP 401. Os
advisors de segurança não apontaram novos problemas nos objetos criados.

## Layout do app 1.1

O APK 1.1 e a prévia web reúnem os anúncios `top` e `bottom` em um único carrossel quadrado superior, reordenado por `position` de forma estável. A rotação permanece em 15 segundos. O painel recomenda 1080 × 1080 px e cria novos anúncios em `top`; preserva o slot de anúncios existentes para instalações 1.0. Nenhuma migração de banco ou mudança no contrato público é necessária.
