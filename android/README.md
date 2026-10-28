# JK HipHop para Android

Aplicativo nativo Java, sem WebView e sem login de ouvintes. O conteúdo vem da mesma administração master do site.

## Interface e gestão

- Publicidade quadrada na parte superior e player compacto preto e dourado na parte inferior, com volume e estado real de reprodução.
- No APK **1.2.0**, faixa amarela abaixo da publicidade com mensagem deslizante de até 300 caracteres e texto preto ou branco. Configure em **Admin → Aplicativo → Faixa amarela abaixo da publicidade** e clique em **Salvar aplicativo**. É possível ocultar a faixa. Toque nela para pausar/continuar; a animação só funciona em primeiro plano e respeita animações desativadas no Android.
- Um carrossel superior reúne todos os anúncios ativos, inclusive os cadastrados no antigo rodapé, ordenados por posição, com rotação a cada **15 segundos** enquanto o aplicativo está visível.
- Banner recomendado: **1080 × 1080 px, proporção 1:1**, JPG, PNG, WebP ou GIF até 5 MB. A imagem inteira é exibida com `FIT_CENTER`; outros formatos de proporção recebem espaço livre, sem corte ou deformação. O Android exibe a primeira imagem de GIFs, sem animação.
- Redes sociais só aparecem quando o respectivo endereço está cadastrado. Links e anúncios abrem no navegador do aparelho.
- Menu com enquete compartilhada com o site, contato e privacidade. O master pode ocultar enquete e contato somente no app.
- Nome, slogan, logo, fundo, banners, transmissão e canais de contato são configurados em **Admin → Aplicativo**.
- Logo e fundo incluídos no APK reutilizam a identidade JK HipHop e a imagem `public/images/hero.webp` do projeto. Para substituir a logo no Android, use PNG ou WebP com transparência; o SVG padrão da marca tem equivalente vetorial nativo incluído.

O app busca a configuração ao abrir, ao retornar para a tela e a cada 60 segundos em primeiro plano. A última configuração válida fica salva no aparelho para abrir sem rede. Esse cache não reproduz áudio sem internet. Os banners não aparecem quando não existem anúncios ativos; a transmissão ausente é identificada como **em configuração**.

## Reprodução

AndroidX Media3 mantém o player em um `MediaSessionService`, com reprodução em segundo plano, controles de mídia do Android/notificação/tela bloqueada, foco de áudio e pausa ao desconectar fones. A reprodução começa apenas por ação do ouvinte. O volume do app é aplicado sobre o volume de mídia do aparelho.

Ao pausar, o serviço descarta o buffer da transmissão. O próximo play reabre o stream ao vivo, inclusive pelos controles da tela bloqueada; trocar de aplicativo mantém a reprodução em segundo plano.

Somente URLs HTTPS são aceitas para conteúdo remoto. O app não contém chaves Supabase, senha do administrador ou segredos de votação. O endpoint público `/api/app` retorna apenas configuração publicada. O voto usa `/api/poll`, `Origin` do site e cookie assinado persistente; a validação e o limite de votos continuam no servidor. O indicador local de participação complementa a proteção do servidor e não substitui essa proteção.

O aplicativo não solicita localização, contatos, armazenamento, microfone nem cadastro do usuário. A permissão de serviço de mídia é usada somente para a reprodução solicitada.

## Compilar

Ferramentas fixadas:

| Ferramenta | Versão |
| --- | --- |
| Java | 17 |
| Gradle Wrapper | 9.3.1 |
| Android Gradle Plugin | 9.1.1 |
| AndroidX Media3 | 1.11.1 |
| SDK de compilação / destino | 36 |
| Build Tools | 36.1.0 |
| Android mínimo | 8.0 / API 26 |

No Android Studio, abra esta pasta e selecione o SDK instalado. Fora do Android Studio, defina `JAVA_HOME` e `ANDROID_HOME` ou crie um `local.properties` não versionado com `sdk.dir` apontando para seu SDK.

```powershell
.\gradlew.bat :app:assembleDebug :app:lintRelease
```

O pacote de debug é `org.radiojkhiphop.app.debug`, separado da instalação de produção. Para testar a API local no emulador, com o servidor na porta 3000:

```powershell
adb reverse tcp:3000 tcp:3000
.\gradlew.bat :app:assembleDebug -PappApiUrl=http://127.0.0.1:3000/api/app
```

Essa opção altera somente o debug. O HTTP fica restrito à API e votação locais (`localhost`, `127.0.0.1` e `10.0.2.2`); imagens e stream continuam exigindo HTTPS. O backend local deve aceitar a mesma origem HTTP da API, por isso o exemplo usa `adb reverse`. O release sempre usa o endereço HTTPS de produção, mesmo quando a propriedade `appApiUrl` está presente.

Para release, crie `android/signing.properties` (ignorado pelo Git):

```properties
storeFile=C:/caminho/privado/jk-hiphop-release.jks
storePassword=SENHA_PRIVADA
keyAlias=jk-hiphop
keyPassword=SENHA_PRIVADA
```

```powershell
.\gradlew.bat :app:assembleRelease
```

Saída: `app/build/outputs/apk/release/app-release.apk`. Sem `signing.properties`, a saída de release permanece sem assinatura. Preserve a chave e suas senhas em local privado com backup: as próximas versões precisam da mesma assinatura para atualizar o aplicativo instalado.

## Contratos públicos

`GET https://webradiodeluxe.vercel.app/api/app`:

```json
{
  "schema_version": 1,
  "settings": {
    "radio_name": "JK HipHop",
    "tagline": "O rap em alto nível.",
    "logo_url": null,
    "background_url": null,
    "show_poll": true,
    "show_contact": true,
    "banner_interval_seconds": 15,
    "ticker_enabled": true,
    "ticker_text": "JK HipHop • O rap em alto nível. • Siga @radiojkhiphop",
    "ticker_text_color": "black"
  },
  "radio": {
    "stream_url": "",
    "instagram_url": "",
    "facebook_url": "",
    "tiktok_url": "",
    "youtube_url": "",
    "whatsapp_url": "",
    "contact_email": "",
    "contact_text": ""
  },
  "banners": [],
  "poll": null,
  "poll_available": true
}
```

Cada banner: `id`, `title`, `alt_text`, `image_url`, `target_url`, `slot` (`top`/`bottom`), `position`. A rotação permanece em 15 segundos e não é controlada por valores arbitrários recebidos da API.

Os campos `ticker_*` são aditivos e mantêm `schema_version=1`. APKs anteriores ignoram esses campos. O novo APK oculta a faixa se os campos estiverem ausentes ou se o texto estiver vazio; somente `white` ativa texto branco, e o padrão é `black`. O texto é conteúdo literal, sem HTML. Depois de instalar o APK 1.2.0, alterações no painel chegam sem reinstalação, na próxima consulta de configuração.

Enquete disponível: `poll: {id, question, status, ends_at, total, options:[{id,label,votes}]}`. `POST /api/poll` recebe `{poll_id, option_id}` e retorna `{already_voted, results}`. A API só aceita o `Origin` canônico do site; o app envia esse valor explicitamente. O cookie assinado é salvo apenas para essa origem e nunca enviado a imagens ou anunciantes.

O endereço da API está fixado em `app/build.gradle`. Quando o domínio próprio estiver conectado e testado, atualize esse endereço e `ApiClient.ORIGIN` juntos, mantendo a mesma origem canônica da API de votação.

Documentação primária consultada: [compatibilidade AGP 9.1](https://developer.android.com/build/releases/agp-9-1-0-release-notes?hl=en), [Media3 1.11.1](https://developer.android.com/jetpack/androidx/releases/media3), [reprodução em segundo plano](https://developer.android.com/media/media3/session/background-playback).
