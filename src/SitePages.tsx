import type { ReactNode } from "react";
import { useSiteContent, instagramDetails } from "./site-content";
import { safeUrl } from "./lib";

const links = [
  ["/", "Ouvir a rádio"],
  ["/programacao", "Programação"],
  ["/sobre", "Sobre"],
  ["/contato", "Contato"],
] as const;

function InstagramLink({ children }: { children?: string }) {
  const { settings } = useSiteContent();
  const instagram = instagramDetails(settings.instagram_url);
  if (!instagram.url) return <a className="yellow-button" href="/contato">Canais de contato <span aria-hidden="true">↗</span></a>;
  return (
    <a className="yellow-button" href={instagram.url} target="_blank" rel="noopener noreferrer">
      {children || `Falar com ${instagram.handle}`} <span aria-hidden="true">↗</span>
    </a>
  );
}

export function ContactChannels() {
  const { settings } = useSiteContent();
  const instagram = instagramDetails(settings.instagram_url);
  const email = settings.contact_email?.trim();
  const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  const channels = [
    { label: "WhatsApp", url: safeUrl(settings.whatsapp_url) },
    { label: instagram.handle || "Instagram", url: instagram.url },
    { label: "YouTube", url: safeUrl(settings.youtube_url) },
    { label: "Facebook", url: safeUrl(settings.facebook_url) },
    { label: "TikTok", url: safeUrl(settings.tiktok_url) },
  ].filter((channel) => channel.url);
  if (!validEmail && !channels.length) return <p className="muted-text">Os canais de contato serão divulgados pela rádio em breve.</p>;
  return (
    <div className="contact-channels">
      {validEmail && <a className="yellow-button" href={`mailto:${encodeURIComponent(validEmail).replace("%40", "@")}`}>Enviar e-mail: {validEmail}</a>}
      {channels.map((channel) => <a className="outline-button" href={channel.url!} key={channel.label} target="_blank" rel="noopener noreferrer">{channel.label} <span aria-hidden="true">↗</span></a>)}
    </div>
  );
}

function ProgramPage() {
  const { items } = useSiteContent();
  const programs = items.filter((item) => item.kind === "program");
  return (
    <>
      <span className="eyebrow">ENCONTRE A SUA BATIDA</span>
      <h1>Programação da JK HipHop</h1>
      <p className="site-page-lead">
        Das referências dos anos 90 e 2000 às músicas que você quer ouvir agora:
        conheça os programas que dão identidade à nossa seleção de rap
        nacional e internacional.
      </p>
      <div className="site-page-programs">
        {programs.map((program) => (
          <section className={`site-page-program ${program.image_url ? "" : "without-image"}`} key={program.id}>
            {program.image_url && <img src={program.image_url} alt="" width="480" height="320" loading="lazy" />}
            <div>
              <h2>{program.title}</h2>
              <p>{program.description}</p>
              {(program.time_label || program.days_label) && <p className="site-page-program-time">
                <strong>Horário proposto:</strong> {[program.time_label, program.days_label].filter(Boolean).join(" · ")}
              </p>}
              {safeUrl(program.link_url) && <a href={safeUrl(program.link_url)!} target="_blank" rel="noopener noreferrer">Conheça o programa ↗</a>}
            </div>
          </section>
        ))}
        {!programs.length && <p>A programação está sendo atualizada. Volte em breve.</p>}
      </div>
      <section className="site-page-note">
        <h2>Como acompanhar os programas</h2>
        <p>
          Esta é a proposta de programação da JK HipHop. Os horários e os dias
          apresentados ainda dependem de confirmação da rádio; consulte os
          avisos no site e no Instagram antes de acompanhar um programa
          específico.
        </p>
        <p>
          Para ouvir, volte à página principal e use o botão de reprodução do
          player. Você controla o volume e pode pausar a transmissão quando
          quiser. A reprodução depende da sua conexão e da disponibilidade do
          streaming.
        </p>
        <a className="yellow-button" href="/">
          Ouvir a JK HipHop
        </a>
      </section>
      <section>
        <h2>O seu pedido também tem espaço</h2>
        <p>
          Quer sugerir uma música? Envie o nome da faixa e
          do artista pelos canais de contato da rádio. Conte por que esse som merece entrar na
          frequência. Os pedidos estão sujeitos à seleção e à disponibilidade da
          programação.
        </p>
        <InstagramLink children="Pedir uma música no Instagram" />
      </section>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <span className="eyebrow">RAP É CULTURA. RESPEITO É A BASE.</span>
      <h1>Uma rádio para quem vive o hip-hop</h1>
      <p className="site-page-lead">
        A JK HipHop é uma web rádio dedicada ao rap nacional e internacional.
        Nossa proposta é aproximar a música, a conversa e a participação de quem
        reconhece nessa cultura uma forma de expressão.
      </p>
      <section>
        <h2>Raízes, descobertas e boa conversa</h2>
        <p>
          O rap atravessa gerações. Uma faixa dos anos 90 pode abrir caminho
          para descobrir um artista atual; uma batida internacional pode
          dialogar com histórias contadas no Brasil. A programação da JK HipHop
          parte desse encontro entre repertórios, sem perder o respeito por quem
          construiu o movimento.
        </p>
        <p>
          Os programas representam formas diferentes de entrar nessa conversa:
          revisitar referências, acompanhar uma sequência de músicas, sugerir
          um som ou compartilhar uma boa resenha.
        </p>
        <a href="/programacao">Conheça a proposta de cada programa</a>.
      </section>
      <section>
        <h2>Como ouvir a rádio online</h2>
        <p>
          A transmissão fica no player da página principal. Toque no botão de
          play para iniciar o áudio, ajuste o volume e mantenha a página aberta
          enquanto quiser ouvir. Não é necessário criar uma conta para
          acompanhar o site ou participar da enquete disponível.
        </p>
        <p>
          O áudio utiliza a conexão com a internet e pode consumir o plano de
          dados do seu dispositivo. Em caso de interrupção, confira sua conexão
          e tente iniciar o player novamente.
        </p>
      </section>
      <section>
        <h2>Participe da nossa frequência</h2>
        <p>
          A sua sugestão pode trazer uma faixa, um tema de conversa ou uma nova
          perspectiva para a rádio. Participe da enquete na página inicial e
          acompanhe os canais oficiais para conversar com a JK HipHop.
        </p>
        <InstagramLink children="Chegue junto no Instagram" />
      </section>
      <section>
        <h2>Informação com fonte identificada</h2>
        <p>
          A área de notícias reúne chamadas de veículos externos e identifica a
          origem de cada publicação. A leitura completa acontece no site da
          fonte. Entenda essa seleção e os critérios para imagens e publicidade
          na nossa <a href="/editorial">política editorial</a>.
        </p>
      </section>
    </>
  );
}

function ContactPage() {
  const { settings } = useSiteContent();
  return (
    <>
      <span className="eyebrow">A SUA VOZ FAZ PARTE</span>
      <h1>Fale com a JK HipHop</h1>
      <p className="site-page-lead">
        {settings.contact_text || "Tem um pedido de música, uma ideia de pauta ou uma proposta de parceria? Escolha um dos canais oficiais abaixo e fale com a JK HipHop."}
      </p>
      <ContactChannels />
      <section>
        <h2>Pedidos de músicas</h2>
        <p>
          Envie o nome da música e do artista. Se houver mais de uma versão,
          indique qual você gostaria de ouvir. Conte também o que esse som
          representa para você. Os pedidos passam pela seleção da rádio e não
          representam uma promessa de execução imediata.
        </p>
      </section>
      <section>
        <h2>Artistas, produtores e parceiros</h2>
        <p>
          Para apresentar um trabalho, envie uma breve descrição e um link
          oficial para ouvir a música. Para publicidade ou parcerias, descreva
          sua marca, o objetivo da proposta e o período de interesse. A
          avaliação depende da compatibilidade com a rádio e da disponibilidade
          dos espaços.
        </p>
        <p>
          O envio de material não garante divulgação ou aprovação de uma
          campanha. Encaminhe apenas conteúdo sobre o qual você tenha
          autorização de uso.
        </p>
      </section>
      <section>
        <h2>Correções, direitos autorais e privacidade</h2>
        <p>
          Se identificar uma informação incorreta, envie o link da página ou o
          título da chamada, descreva o problema e inclua uma referência
          verificável quando possível. Para questões de direitos autorais,
          informe qual material está envolvido e sua relação com ele.
        </p>
        <p>
          Solicitações sobre dados pessoais também podem começar por esse canal.
          Não envie senhas, documentos ou outros dados sensíveis em comentários
          públicos. Consulte nossa{" "}
          <a href="/privacidade">política de privacidade</a> para entender os
          dados tratados pelo site.
        </p>
      </section>
    </>
  );
}

function PrivacyPage() {
  return (
    <>
      <span className="eyebrow">TRANSPARÊNCIA NO USO DOS DADOS</span>
      <h1>Política de Privacidade</h1>
      <p className="site-page-lead">
        Esta política explica o tratamento de dados no site da JK HipHop. A
        navegação e a reprodução da rádio são abertas; visitantes não precisam
        criar uma conta.
      </p>
      <section>
        <h2>Navegação e transmissão</h2>
        <p>
          A hospedagem na Vercel e os demais serviços necessários ao
          funcionamento do site podem processar dados técnicos, como endereço de
          conexão, navegador e informações de requisições, para entregar
          páginas, manter a segurança e diagnosticar falhas. O serviço de
          streaming recebe a conexão necessária para entregar o áudio quando
          você inicia o player.
        </p>
        <p>
          As fontes tipográficas são carregadas do Google Fonts. Essa conexão
          pode transmitir informações técnicas ao provedor. Links para
          Instagram, veículos de notícias e outras plataformas levam a serviços
          que possuem suas próprias políticas de privacidade.
        </p>
      </section>
      <section>
        <h2>Enquete e prevenção de votos repetidos</h2>
        <p>
          Ao votar, o site utiliza um cookie necessário com identificador
          assinado e registra no navegador a indicação de que você já participou
          daquela enquete. Isso permite reconhecer a participação sem exigir uma
          conta. O armazenamento local também ajuda a mostrar os resultados após
          o voto.
        </p>
        <p>
          O sistema armazena a alternativa escolhida, a data do voto e códigos
          derivados do identificador do navegador e do endereço de conexão para
          evitar duplicações e limitar abusos. O banco de votos não guarda o
          endereço IP em texto aberto. Apenas os resultados agregados ficam
          disponíveis ao público; votos individuais não são exibidos.
        </p>
        <p>
          A identificação por navegador não comprova a identidade de uma pessoa.
          Limpar os cookies ou mudar de dispositivo pode alterar o
          reconhecimento. Você pode administrar cookies e dados locais nas
          configurações do seu navegador, sabendo que isso pode afetar a
          experiência da enquete.
        </p>
      </section>
      <section>
        <h2>Acesso administrativo</h2>
        <p>
          O login é exclusivo do administrador autorizado. A autenticação e os
          dados de conteúdo são mantidos com o Supabase. O painel usa
          informações da sessão para controlar o acesso às funções de gestão;
          elas não são disponibilizadas aos visitantes do site.
        </p>
      </section>
      <section>
        <h2>Comunicações e dados já fornecidos</h2>
        <p>
          O site não disponibiliza formulário público de newsletter. Caso você
          tenha fornecido anteriormente um e-mail com consentimento, pode
          solicitar informações, correção ou exclusão pelo canal de contato da
          rádio. Não vendemos a lista de contatos.
        </p>
        <p>
          Uma mensagem enviada pelo Instagram é tratada também pela plataforma.
          Compartilhe apenas as informações necessárias para o atendimento e
          evite publicar dados sensíveis em comentários.
        </p>
      </section>
      <section>
        <h2>Publicidade e serviços de terceiros</h2>
        <p>
          Esta versão não usa Google Analytics, código de anúncios do Google
          AdSense nem cookies de publicidade próprios. Banners de parceiros e
          links externos, quando apresentados, são identificados como
          publicidade e podem direcionar você a outros sites. A política do
          destino se aplica a partir do acesso a esses serviços.
        </p>
        <p>
          Se forem adotadas ferramentas que alterem esse tratamento de dados,
          esta política deverá ser atualizada e serão apresentados os controles
          de consentimento exigidos para a implementação utilizada.
        </p>
      </section>
      <section>
        <h2>Seus pedidos e atualizações desta política</h2>
        <p>
          Para perguntar sobre o tratamento de dados ou solicitar acesso,
          correção ou exclusão, utilize os <a href="/contato">canais de contato da rádio</a>. Pode ser
          necessário confirmar sua relação com os dados antes de atender a
          solicitação, para proteger outras pessoas. Os dados são mantidos
          conforme a necessidade de funcionamento, segurança e atendimento de
          obrigações aplicáveis.
        </p>
        <p>
          Esta página será atualizada quando houver mudanças relevantes no site.
          Para mais informações sobre seu uso, consulte os{" "}
          <a href="/termos">termos de uso</a>.
        </p>
        <InstagramLink children="Falar sobre privacidade" />
      </section>
    </>
  );
}

function TermsPage() {
  return (
    <>
      <span className="eyebrow">REGRAS PARA UMA BOA EXPERIÊNCIA</span>
      <h1>Termos de uso</h1>
      <p className="site-page-lead">
        A JK HipHop disponibiliza uma rádio online, informações sobre a
        programação, participação em enquetes e chamadas para notícias de
        música. Ao utilizar esses recursos, respeite as condições descritas
        nesta página.
      </p>
      <section>
        <h2>Uso do site e disponibilidade</h2>
        <p>
          O acesso público não exige cadastro. O início da reprodução depende de
          uma ação no player e de uma conexão compatível. A transmissão e os
          recursos do site podem sofrer interrupções por manutenção, problemas
          técnicos ou indisponibilidade dos provedores.
        </p>
        <p>
          As propostas de programas e os horários apresentados podem ser
          ajustados. Consulte as informações publicadas pela rádio antes de
          planejar o acompanhamento de uma atração específica. Eventuais custos
          de acesso à internet são definidos pelo seu provedor.
        </p>
      </section>
      <section>
        <h2>Participação responsável</h2>
        <p>
          Enquetes e canais de contato devem ser usados com respeito. Não
          utilize automações para manipular votos, explorar falhas, tentar obter
          acesso ao painel ou prejudicar o funcionamento da rádio. O acesso
          administrativo é restrito ao administrador autorizado.
        </p>
        <p>
          Pedidos de músicas, sugestões e materiais enviados são avaliados pela
          rádio e não geram garantia de veiculação. Não encaminhe conteúdo
          ilegal, discriminatório, ameaçador ou que viole direitos de terceiros.
        </p>
      </section>
      <section>
        <h2>Conteúdo, marca e direitos autorais</h2>
        <p>
          A marca, o layout e os materiais próprios da JK HipHop devem ter sua
          autoria respeitada. A disponibilidade de áudio ou imagens no site não
          transfere direitos de reprodução, redistribuição ou exploração
          comercial. Obras musicais e conteúdos de terceiros permanecem sujeitos
          aos direitos de seus respectivos titulares.
        </p>
        <p>
          Quem envia um trabalho para avaliação deve possuir autorização para
          compartilhá-lo. Se você for titular de direitos e identificar um uso
          que precise ser esclarecido, utilize o{" "}
          <a href="/contato">canal de contato</a> e indique o material
          envolvido.
        </p>
      </section>
      <section>
        <h2>Notícias e links externos</h2>
        <p>
          Chamadas de notícias identificam a fonte e levam ao veículo
          responsável pela publicação completa. O conteúdo e a disponibilidade
          dessas páginas são controlados pelos respectivos veículos. A inclusão
          de um link não significa endosso a todas as opiniões, produtos ou
          serviços do destino.
        </p>
        <p>
          Consulte a <a href="/editorial">política editorial</a> para entender a
          seleção de chamadas e a identificação de anúncios, e a{" "}
          <a href="/privacidade">política de privacidade</a> para conhecer o uso
          de dados no site.
        </p>
      </section>
      <section>
        <h2>Atualizações e contato</h2>
        <p>
          Estes termos podem ser atualizados para acompanhar mudanças nos
          serviços. Dúvidas sobre o site, sua programação ou estas condições
          podem ser encaminhadas pelos <a href="/contato">canais de contato da rádio</a>.
        </p>
        <InstagramLink />
      </section>
    </>
  );
}

function EditorialPage() {
  return (
    <>
      <span className="eyebrow">FONTES CLARAS. RESPEITO À AUTORIA.</span>
      <h1>Política editorial e de publicidade</h1>
      <p className="site-page-lead">
        A JK HipHop conecta ouvintes à música e à cultura hip-hop. Esta página
        explica como os conteúdos do site são apresentados e como distinguir
        informações da rádio, chamadas de veículos externos e publicidade.
      </p>
      <section>
        <h2>O que você encontra na área de notícias</h2>
        <p>
          A seção reúne manchetes de notícias de música em português,
          selecionadas automaticamente por meio da Currents News API. Cada
          chamada identifica a fonte e oferece um link para a publicação
          completa no veículo responsável. Essas chamadas não são reportagens
          produzidas pela JK HipHop.
        </p>
        <p>
          A automação verifica idioma, data, relação com música e duplicações. A
          meta de atualização é de até três chamadas por dia, conforme a
          existência de notícias elegíveis e a disponibilidade do serviço. A
          seleção automática não equivale à checagem humana de todos os fatos
          relatados pelo veículo de origem.
        </p>
        <p>
          O sistema não copia o artigo completo nem importa as fotografias da
          notícia. As chamadas automáticas permanecem disponíveis por um período
          limitado de sete dias. Quando indicado, autor e data original se
          referem à publicação da fonte; a data de inclusão no site pode ser
          diferente.
        </p>
      </section>
      <section>
        <h2>Conteúdo próprio e imagens ilustrativas</h2>
        <p>
          As informações institucionais e as apresentações dos programas
          explicam a proposta da rádio. Os horários apresentados na grade ainda
          são propostos e dependem de confirmação. Conteúdo próprio e chamadas
          externas devem manter sua origem identificada.
        </p>
        <p>
          As artes conceituais da rádio foram criadas com auxílio de geração de
          imagens e têm função ilustrativa. Elas não documentam artistas,
          pessoas ou eventos citados nas notícias. Imagens ilustrativas junto a
          chamadas são identificadas como tal. Materiais externos devem ter
          autorização de uso e identificação apropriada da autoria.
        </p>
      </section>
      <section>
        <h2>Correções e direitos de terceiros</h2>
        <p>
          Se uma chamada apresentar erro de título, atribuição, data ou link,
          informe o problema pelos <a href="/contato">canais de contato da rádio</a>. Envie o título ou o
          endereço da página e uma referência que ajude na verificação. A rádio
          poderá corrigir ou retirar a chamada após avaliar o caso.
        </p>
        <p>
          Para contestar o conteúdo da reportagem completa, procure também o
          veículo que a publicou. Solicitações relacionadas a direitos autorais,
          uso de imagem ou remoção devem identificar o material e a relação do
          solicitante com o direito alegado. Não é necessário divulgar
          documentos pessoais em comentários públicos.
        </p>
      </section>
      <section>
        <h2>Como identificar publicidade</h2>
        <p>
          Banners e espaços comerciais são identificados como publicidade. O
          destino de um anúncio pode ser um serviço de terceiros, sujeito às
          próprias condições e políticas. A presença de uma marca em um banner
          não transforma o anúncio em recomendação editorial nem garante o
          resultado do produto anunciado.
        </p>
        <p>
          Propostas comerciais devem informar o anunciante, o destino do link e
          o material a ser veiculado. A avaliação considera a adequação à rádio
          e o respeito aos direitos das pessoas. Conteúdo patrocinado deve ser
          sinalizado para que o ouvinte reconheça a relação comercial.
        </p>
      </section>
      <section>
        <h2>Converse com a rádio</h2>
        <p>
          Use nosso canal público para sugerir temas, apontar problemas ou
          apresentar uma proposta. Sua participação ajuda a manter a frequência
          relevante para quem vive a cultura hip-hop.
        </p>
        <InstagramLink children="Enviar uma sugestão ou correção" />
      </section>
    </>
  );
}

function NotFoundPage() {
  return (
    <>
      <span className="eyebrow">404 · FORA DA FREQUÊNCIA</span>
      <h1>Página não encontrada</h1>
      <p className="site-page-lead">
        O endereço acessado não corresponde a uma página da JK HipHop. Volte à
        rádio para ouvir a transmissão ou conheça os nossos programas.
      </p>
      <a className="yellow-button" href="/">
        Voltar para a rádio
      </a>
      <p>
        <a href="/programacao">Conhecer a programação</a>
      </p>
    </>
  );
}

export default function SitePage({ path }: { path: string }) {
  const { settings } = useSiteContent();
  const instagram = instagramDetails(settings.instagram_url);
  const pathname = (path.split(/[?#]/, 1)[0] || "/").replace(/\/+$/, "") || "/";
  const pageByPath: Record<string, ReactNode> = {
    "/programacao": <ProgramPage />,
    "/sobre": <AboutPage />,
    "/contato": <ContactPage />,
    "/privacidade": <PrivacyPage />,
    "/termos": <TermsPage />,
    "/editorial": <EditorialPage />,
  };
  const page = pageByPath[pathname];
  return (
    <div className="site-page">
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="site-page-header container">
        <a
          className="site-page-brand"
          href="/"
          aria-label="JK HipHop — página inicial"
        >
          <img
            src="/logo-jk-hiphop.svg"
            alt="JK HipHop Web Rádio"
            width="155"
            height="52"
          />
        </a>
        <nav aria-label="Navegação principal">
          {links.map(([href, label]) => (
            <a
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main className="reading-page container" id="conteudo">
        <article>{page || <NotFoundPage />}</article>
      </main>
      <footer className="site-page-footer container">
        <a href="/" aria-label="Voltar à JK HipHop">
          <img
            src="/logo-jk-hiphop.svg"
            alt="JK HipHop Web Rádio"
            width="155"
            height="52"
          />
        </a>
        <p>Rap nacional e internacional. Música, cultura e respeito.</p>
        <nav aria-label="Informações da rádio">
          <a href="/sobre">Sobre a JK HipHop</a>
          <a href="/contato">Contato</a>
          <a href="/privacidade">Privacidade</a>
          <a href="/termos">Termos de uso</a>
          <a href="/editorial">Política editorial</a>
          {instagram.url && <a href={instagram.url} target="_blank" rel="noopener noreferrer">{instagram.handle} ↗</a>}
          {safeUrl(settings.youtube_url) && <a href={safeUrl(settings.youtube_url)!} target="_blank" rel="noopener noreferrer">YouTube ↗</a>}
          {safeUrl(settings.facebook_url) && <a href={safeUrl(settings.facebook_url)!} target="_blank" rel="noopener noreferrer">Facebook ↗</a>}
          {safeUrl(settings.tiktok_url) && <a href={safeUrl(settings.tiktok_url)!} target="_blank" rel="noopener noreferrer">TikTok ↗</a>}
          {safeUrl(settings.whatsapp_url) && <a href={safeUrl(settings.whatsapp_url)!} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>}
        </nav>
        <small>
          © JK HipHop. Respeite os direitos dos respectivos autores e
          titulares.
        </small>
      </footer>
    </div>
  );
}
