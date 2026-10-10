import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useScrollReveal } from "./Motion";
import { BannerSlot, useAdBanners } from "./Advertising";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Diamond,
  Headphones,
  LoaderCircle,
  Mail,
  Maximize2,
  Menu,
  Music2,
  Pause,
  Play,
  Search,
  Share2,
  Smartphone,
  Target,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { programs, playlists } from "./content";
import { safeUrl, supabase, type RadioSettings } from "./lib";
import { ListenerPoll, NewsFeed } from "./PublicFeatures";

export type ModalContent = { title: string; eyebrow?: string; body: ReactNode };
const navigation = [
  ["Início", "#inicio"],
  ["Programas", "#programacao"],
  ["Notícias", "#noticias"],
  ["Playlists", "#playlists"],
  ["Enquete", "#enquete"],
] as const;
const slides = [
  {
    eyebrow: "A RUA TEM VOZ. E TEM FREQUÊNCIA.",
    title: (
      <>
        O RAP EM
        <br />
        <span>ALTO NÍVEL.</span>
      </>
    ),
    copy: "Música. Cultura. Respeito. Sem fronteiras.",
    image: "hero",
  },
  {
    eyebrow: "DA RUA PARA O MUNDO.",
    title: (
      <>
        NOSSA CULTURA.
        <br />
        <span>NOSSA VOZ.</span>
      </>
    ),
    copy: "O som que conecta histórias e atravessa gerações.",
    image: "battle",
  },
  {
    eyebrow: "RESPEITO ÀS RAÍZES. OLHAR NO FUTURO.",
    title: (
      <>
        A BATIDA
        <br />
        <span>NÃO PARA.</span>
      </>
    ),
    copy: "Dos clássicos à nova escola. Aqui, o rap tem casa.",
    image: "vinyl",
  },
];

export function Brand({
  large = false,
  compact = false,
}: {
  large?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`brand ${large ? "brand-large" : ""}`}
      aria-label="JK HipHop Web Rádio"
    >
      <img
        src={compact ? "/jk-monogram.svg" : "/logo-jk-hiphop.svg"}
        alt=""
        width={compact ? 144 : 310}
        height={compact ? 112 : 104}
      />
    </span>
  );
}

export function Modal({
  content,
  close,
}: {
  content: ModalContent | null;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (content && dialog && !dialog.open) dialog.showModal();
    if (!content && dialog?.open) dialog.close();
  }, [content]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      {content && (
        <div className="dialog-content" key={content.title}>
          <button
            className="icon-button dialog-close"
            aria-label="Fechar janela"
            onClick={close}
          >
            <X />
          </button>
          <span className="eyebrow">
            {content.eyebrow || "WEB RÁDIO JK HIPHOP"}
          </span>
          <h2>{content.title}</h2>
          {content.body}
        </div>
      )}
    </dialog>
  );
}

function SearchContent({ open }: { open: (content: ModalContent) => void }) {
  const [query, setQuery] = useState("");
  const [news, setNews] = useState<
    { title: string; body: string; source_url: string | null }[]
  >([]);
  useEffect(() => {
    let mounted = true;
    if (supabase)
      void supabase
        .from("news_posts")
        .select("title,body,source_url")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (mounted) setNews(data || []);
        });
    return () => {
      mounted = false;
    };
  }, []);
  const items = [
    ...programs.map((item) => ({
      title: item.title,
      type: "Programa",
      text: item.description,
      url: null,
    })),
    ...news.map((item) => ({
      title: item.title,
      type: "Notícia",
      text: item.body,
      url: safeUrl(item.source_url),
    })),
  ];
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const results = items.filter((item) =>
    normalized(item.title + item.text).includes(normalized(query)),
  );
  return (
    <>
      <label className="search-label" htmlFor="site-search">
        Busque programas e conteúdos
      </label>
      <div className="search-input">
        <Search size={20} />
        <input
          id="site-search"
          autoFocus
          placeholder="O que você quer encontrar?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="search-results" aria-live="polite">
        {results.length ? (
          results.map((item) => (
            <button
              key={item.title}
              onClick={() =>
                open({
                  title: item.title,
                  eyebrow: item.type,
                  body: (
                    <>
                      <p>
                        {item.text ||
                          "Confira a notícia no veículo responsável pela publicação."}
                      </p>
                      {"url" in item && item.url && (
                        <a
                          className="yellow-button"
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ler na fonte original <ArrowRight size={16} />
                        </a>
                      )}
                    </>
                  ),
                })
              }
            >
              <span>
                <small>{item.type}</small>
                {item.title}
              </span>
              <ArrowRight size={18} />
            </button>
          ))
        ) : (
          <p>Nenhum resultado. Tente “rap”, “cultura” ou “clássicos”.</p>
        )}
      </div>
    </>
  );
}

function Newsletter({ openPrivacy }: { openPrivacy: () => void }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === "loading" || !consent) return;
    if (company) {
      setStatus("success");
      return;
    }
    if (!supabase) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert({ email: email.trim().toLowerCase(), consent: true });
      if (error && error.code !== "23505") throw error;
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }
  return (
    <form onSubmit={submit} className="newsletter">
      <h3>NA FREQUÊNCIA DAS NOVIDADES</h3>
      <p>
        Receba o que acontece na JK HipHop.
        <br />
        Sem ruído. Só o que importa.
      </p>
      <label className="sr-only" htmlFor="newsletter-email">
        Seu e-mail
      </label>
      <div className="email-field">
        <input
          id="newsletter-email"
          type="email"
          maxLength={254}
          placeholder="Seu melhor e-mail"
          value={email}
          required
          disabled={status === "loading" || status === "success"}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
        />
        <button
          type="submit"
          className="yellow-button"
          disabled={!consent || status === "loading" || status === "success"}
          aria-label="Cadastrar e-mail"
        >
          {status === "loading" ? (
            <LoaderCircle className="spin" size={19} />
          ) : status === "success" ? (
            <Check size={19} />
          ) : (
            <ArrowRight size={21} />
          )}
        </button>
      </div>
      <label className="consent">
        <input
          type="checkbox"
          required
          checked={consent}
          disabled={status === "success"}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Quero receber novidades por e-mail e li a{" "}
          <button type="button" onClick={openPrivacy}>
            política de privacidade
          </button>
          .
        </span>
      </label>
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="company">Empresa</label>
        <input
          id="company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <p
        className={`form-message ${status === "error" ? "error" : ""}`}
        role="status"
      >
        {status === "success"
          ? "Você está na lista! Valeu por se conectar."
          : status === "error"
            ? "Não foi possível cadastrar agora. Tente novamente."
            : ""}
      </p>
    </form>
  );
}

export function Player({
  settings,
  open,
  close,
}: {
  settings: RadioSettings | null;
  open: (content: ModalContent) => void;
  close: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(70);
  const [muted, setMuted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const stream =
    safeUrl(settings?.stream_url) ||
    safeUrl(import.meta.env.VITE_RADIO_STREAM_URL);
  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume / 100;
      audio.current.muted = muted;
    }
  }, [volume, muted]);
  useEffect(() => {
    setPlaying(false);
    setLoading(false);
    setFeedback("");
  }, [stream]);
  async function toggle() {
    if (!stream) {
      open({
        title: "A próxima batida está chegando.",
        eyebrow: "TRANSMISSÃO EM CONFIGURAÇÃO",
        body: (
          <>
            <p>
              Estamos preparando a frequência da JK HipHop. O player será
              ativado assim que a transmissão da rádio estiver disponível.
            </p>
            <p>
              Enquanto isso, conheça a proposta da programação e explore os
              estilos que fazem parte do nosso universo.
            </p>
            <a className="yellow-button" href="#programacao" onClick={close}>
              Conhecer a programação <ArrowRight size={17} />
            </a>
          </>
        ),
      });
      return;
    }
    if (!audio.current || loading) return;
    if (playing) {
      audio.current.pause();
      return;
    }
    setLoading(true);
    setFeedback("");
    try {
      await audio.current.play();
    } catch {
      setFeedback("Não foi possível conectar à rádio. Tente novamente.");
      setLoading(false);
    }
  }
  async function share() {
    const url = `${window.location.origin}/#player`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "Web Rádio JK HipHop",
          text: "O rap em alto nível.",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setFeedback("Link da JK HipHop copiado!");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setFeedback("Compartilhe este endereço: " + url);
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await panel.current?.requestFullscreen();
    } catch {
      setFeedback("Seu navegador não oferece tela cheia para o player.");
    }
  }
  return (
    <div className="player-wrap" id="player">
      <div className="radio-player" ref={panel}>
        <div className="player-cover">
          <Brand compact />
        </div>
        <button
          className="play-button"
          onClick={toggle}
          aria-label={playing ? "Pausar rádio" : "Ouvir rádio"}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle className="spin" />
          ) : playing ? (
            <Pause fill="currentColor" size={23} />
          ) : (
            <Play fill="currentColor" size={23} />
          )}
        </button>
        <div
          className={`equalizer ${playing ? "is-playing" : ""}`}
          aria-hidden="true"
        >
          {Array.from({ length: 29 }, (_, i) => (
            <span
              key={i}
              style={{
                height: `${8 + ((i * 17 + 9) % 31)}px`,
                animationDelay: `${(i % 7) * -0.14}s`,
              }}
            />
          ))}
        </div>
        <div className="player-info">
          <span className={`live-status ${stream ? "ready" : ""}`}>
            <i />
            {playing
              ? "AO VIVO"
              : stream
                ? "PRONTA PARA TOCAR"
                : "EM BREVE · AO VIVO"}
          </span>
          <strong>Web Rádio JK HipHop</strong>
          <span>
            {playing
              ? "Você está na frequência do rap."
              : "O rap em alto nível."}
          </span>
        </div>
        <div className="player-controls">
          <button
            className="icon-button"
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted || !volume ? <VolumeX size={21} /> : <Volume2 size={21} />}
          </button>
          <input
            aria-label="Volume da rádio"
            className="volume"
            type="range"
            min="0"
            max="100"
            value={volume}
            style={{
              background: `linear-gradient(to right, var(--yellow) ${muted ? 0 : volume}%, #3b3b3b ${muted ? 0 : volume}%)`,
            }}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setMuted(false);
            }}
          />
          <span className="control-divider" />
          <button
            className="icon-button"
            aria-label="Compartilhar rádio"
            onClick={share}
          >
            <Share2 size={19} />
          </button>
          <button
            className="icon-button fullscreen-button"
            aria-label="Player em tela cheia"
            onClick={fullscreen}
          >
            <Maximize2 size={19} />
          </button>
        </div>
        <audio
          ref={audio}
          src={stream || undefined}
          preload="none"
          onPlaying={() => {
            setPlaying(true);
            setLoading(false);
          }}
          onPause={() => {
            setPlaying(false);
            setLoading(false);
          }}
          onWaiting={() => setLoading(true)}
          onEnded={() => {
            setPlaying(false);
            setLoading(false);
          }}
          onError={() => {
            setPlaying(false);
            setLoading(false);
            setFeedback(
              "A transmissão está indisponível. Tente novamente em instantes.",
            );
          }}
        />
      </div>
      {feedback && (
        <p className="player-feedback" role="status">
          {feedback}
        </p>
      )}
    </div>
  );
}

export default function App() {
  const motionRoot = useRef<HTMLElement>(null);
  useScrollReveal(motionRoot);
  const banners = useAdBanners();
  const [menuOpen, setMenuOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [modal, setModal] = useState<ModalContent | null>(null);
  const [settings, setSettings] = useState<RadioSettings | null>(null);
  const playlistTrack = useRef<HTMLDivElement>(null);
  const open = (content: ModalContent) => {
    setMenuOpen(false);
    setModal(content);
  };
  useEffect(() => {
    let active = true;
    if (supabase)
      void supabase
        .from("radio_settings")
        .select("stream_url, instagram_url, youtube_url, contact_email")
        .eq("id", 1)
        .maybeSingle()
        .then(({ data }) => {
          if (active && data) setSettings(data);
        });
    return () => {
      active = false;
    };
  }, []);
  function listen() {
    document.querySelector("#player")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    document.querySelector<HTMLButtonElement>(".play-button")?.click();
  }
  function about() {
    open({
      title: "Mais que uma rádio. Um movimento.",
      body: (
        <>
          <p>
            A JK HipHop nasce da conexão entre música, cultura e respeito. Um
            lugar para quem vive o rap, reconhece suas raízes e quer descobrir o
            que vem a seguir.
          </p>
          <p>
            Rap nacional e internacional, clássicos, boom bap e novas vozes. Sem
            fronteiras, com identidade.
          </p>
          <div className="modal-highlight">
            <Headphones /> O rap em alto nível.
          </div>
        </>
      ),
    });
  }
  function contact(ad = false) {
    open({
      title: ad ? "Sua marca na nossa frequência." : "Vamos trocar uma ideia?",
      eyebrow: ad ? "ANUNCIE NA JK HIPHOP" : "CONTATO",
      body: (
        <>
          <p>
            {ad
              ? "Conecte sua marca a quem vive a música e a cultura hip hop. Os espaços de publicidade da JK HipHop estão sendo preparados para parcerias que fazem sentido para o movimento."
              : "Artistas, produtores, ouvintes e parceiros: queremos construir essa conexão com você."}
          </p>
          {settings?.contact_email ? (
            <a
              className="yellow-button"
              href={`mailto:${settings.contact_email}`}
            >
              <Mail size={18} /> Falar com a JK HipHop
            </a>
          ) : (
            <p className="modal-highlight">
              <Mail /> Nosso canal de contato será divulgado em breve.
            </p>
          )}
        </>
      ),
    });
  }
  function privacy() {
    open({
      title: "Sua privacidade tem espaço aqui.",
      eyebrow: "POLÍTICA DE PRIVACIDADE",
      body: (
        <>
          <p>
            Ao se cadastrar, você autoriza a Web Rádio JK HipHop a guardar seu
            e-mail e enviar novidades da rádio. O cadastro é opcional e depende
            do seu consentimento.
          </p>
          <p>
            Guardamos seu e-mail, a data de cadastro e a confirmação do
            consentimento no Supabase. Esses dados não ficam disponíveis para
            visitantes e não são vendidos. Não usamos cookies de publicidade ou
            ferramentas de rastreamento nesta versão.
          </p>
          <p>
            A enquete usa um identificador anônimo no navegador e um cookie
            necessário para evitar votos repetidos. Guardamos o voto e um código
            derivado do endereço de conexão para limitar abusos; o endereço IP
            não é armazenado em texto aberto. Somente os totais das alternativas
            ficam públicos.
          </p>
          <p>
            O site usa fontes do Google e hospedagem da Vercel, que podem
            processar dados técnicos da conexão. Ao abrir links para outras
            plataformas, aplicam-se as políticas dessas plataformas.
          </p>
          <p>
            O envio de campanhas ainda não está ativo. Antes de começar,
            divulgaremos o canal para consultar, corrigir ou excluir seu
            cadastro e incluiremos a opção de descadastro em cada mensagem.
          </p>
        </>
      ),
    });
  }
  function social(platform: "instagram" | "youtube") {
    const url = safeUrl(
      platform === "instagram"
        ? settings?.instagram_url
        : settings?.youtube_url,
    );
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else
      open({
        title: "O movimento também está nas redes.",
        body: (
          <p>
            Os canais oficiais da JK HipHop serão divulgados em breve. Cadastre
            seu e-mail no rodapé para acompanhar as novidades.
          </p>
        ),
      });
  }
  function program(item: (typeof programs)[number]) {
    open({
      title: item.title,
      eyebrow: "PROGRAMAÇÃO · PROPOSTA INICIAL",
      body: (
        <>
          <img
            className="modal-image"
            src={`/images/${item.image}.webp`}
            alt=""
          />
          <div className="program-meta">
            <span>{item.time}</span>
            <span className="tag">{item.days}</span>
          </div>
          <p>{item.description}</p>
          <p className="muted-text">
            Grade demonstrativa. Os horários e apresentadores serão confirmados
            pela equipe antes da estreia.
          </p>
        </>
      ),
    });
  }
  function playlist(item: (typeof playlists)[number]) {
    open({
      title: item.title,
      eyebrow: "UNIVERSO JK HIPHOP",
      body: (
        <>
          <img
            className="modal-image"
            src={`/images/${item.image}.webp`}
            alt=""
          />
          <p>
            {item.subtitle}. Esta categoria faz parte da curadoria que estamos
            preparando para a JK HipHop.
          </p>
          <p>
            A playlist oficial será publicada em breve. Enquanto isso, explore
            esse estilo no YouTube.
          </p>
          <a
            className="yellow-button"
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.query)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Youtube size={18} /> Explorar no YouTube <ArrowRight size={16} />
          </a>
        </>
      ),
    });
  }
  const current = slides[slide];
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="header-inner">
          <a
            href="#inicio"
            className="logo-link"
            aria-label="JK HipHop, início"
          >
            <Brand />
          </a>
          <nav
            className={`navigation ${menuOpen ? "mobile-open" : ""}`}
            aria-label="Navegação principal"
          >
            {navigation.map(([label, href]) => (
              <a
                key={label}
                className={label === "Início" ? "active" : ""}
                href={href}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <button
              onClick={() =>
                open({
                  title: "As vozes por trás da frequência.",
                  eyebrow: "EQUIPE",
                  body: (
                    <>
                      <p>
                        Estamos reunindo a equipe que vai dar vida à JK HipHop.
                        Em breve, você conhecerá nossos apresentadores, DJs e
                        colaboradores.
                      </p>
                      <p>
                        Gente que vive a cultura e acredita no poder da música.
                      </p>
                    </>
                  ),
                })
              }
            >
              Equipe
            </button>
            <button
              onClick={() =>
                open({
                  title: "A cultura em cada frame.",
                  eyebrow: "GALERIA · IDENTIDADE VISUAL",
                  body: (
                    <>
                      <p>
                        Imagens conceituais criadas com IA para apresentar o
                        universo visual da JK HipHop.
                      </p>
                      <div className="gallery">
                        {[
                          "rapper",
                          "crowd",
                          "city",
                          "vinyl",
                          "battle",
                          "speakers",
                        ].map((image, i) => (
                          <img
                            key={image}
                            src={`/images/${image}.webp`}
                            alt={
                              [
                                "Voz do rap",
                                "Energia do palco",
                                "Cultura urbana",
                                "Raízes da batida",
                                "Encontro de MCs",
                                "Som de rua",
                              ][i]
                            }
                            loading="lazy"
                          />
                        ))}
                      </div>
                    </>
                  ),
                })
              }
            >
              Galeria
            </button>
            <button onClick={() => contact()}>Contato</button>
          </nav>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Buscar no site"
              onClick={() =>
                open({
                  title: "Encontre sua frequência.",
                  eyebrow: "BUSCA",
                  body: <SearchContent open={open} />,
                })
              }
            >
              <Search size={19} />
            </button>
            <span className="header-social">
              <button
                className="icon-button"
                aria-label="Instagram da JK HipHop"
                onClick={() => social("instagram")}
              >
                <Instagram size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="YouTube da JK HipHop"
                onClick={() => social("youtube")}
              >
                <Youtube size={19} />
              </button>
            </span>
            <button className="yellow-button header-listen" onClick={listen}>
              <Play size={15} fill="currentColor" /> OUVIR AGORA
            </button>
            <button
              className="icon-button menu-button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <Player settings={settings} open={open} close={() => setModal(null)} />
      <main id="conteudo" ref={motionRoot} className="page-enter">
        <section
          className={`hero hero-${current.image}`}
          id="inicio"
          aria-roledescription="carrossel"
          aria-label="Destaques JK HipHop"
        >
          <div
            className="hero-image"
            style={{ backgroundImage: `url(/images/${current.image}.webp)` }}
          />
          <div className="hero-shade" />
          <div className="hero-content container">
            <div className="hero-copy" key={slide}>
              <span className="eyebrow">
                <i />
                {current.eyebrow}
              </span>
              <Brand large />
              <h1>{current.title}</h1>
              <p>{current.copy}</p>
              <div className="hero-buttons">
                <button className="yellow-button" onClick={listen}>
                  <Play size={17} fill="currentColor" /> OUÇA A JK HIPHOP
                </button>
                <button className="outline-button" onClick={about}>
                  CONHEÇA A RÁDIO <ArrowRight size={17} />
                </button>
              </div>
            </div>
            <div className="hero-footer">
              <span className="hero-note">
                <span className="tiny-line" /> RAP É CULTURA. RAP É RESISTÊNCIA.
              </span>
              <div className="slide-controls">
                <button
                  aria-label="Destaque anterior"
                  onClick={() =>
                    setSlide((v) => (v + slides.length - 1) % slides.length)
                  }
                >
                  <ChevronLeft size={19} />
                </button>
                <span className="slide-counter">
                  0{slide + 1}
                  <span> / 03</span>
                </span>
                <div className="slide-dots">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Ver destaque ${i + 1}`}
                      aria-current={i === slide ? "true" : undefined}
                      className={i === slide ? "selected" : ""}
                      onClick={() => setSlide(i)}
                    />
                  ))}
                </div>
                <button
                  aria-label="Próximo destaque"
                  onClick={() => setSlide((v) => (v + 1) % slides.length)}
                >
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>
          </div>
          <a
            className="hero-scroll"
            href="#programacao"
            aria-label="Ver programação"
          >
            <ArrowDown size={19} />
          </a>
        </section>
        <div className="container page-content">
          <section className="promo-row" aria-label="Aplicativo e publicidade">
            <BannerSlot slot="app" banners={banners}>
              <button
                className="app-promo"
                onClick={() =>
                  open({
                    title: "Leve a JK HipHop com você.",
                    eyebrow: "APLICATIVO · EM BREVE",
                    body: (
                      <>
                        <p>
                          O aplicativo da Web Rádio JK HipHop está nos nossos
                          planos. Enquanto ele não chega, este site já se adapta
                          ao seu celular.
                        </p>
                        <p>
                          Você pode adicionar o site à tela inicial pelo menu do
                          seu navegador e acessar a JK HipHop com mais
                          facilidade.
                        </p>
                      </>
                    ),
                  })
                }
              >
                <span className="phone-illustration">
                  <Smartphone size={66} />
                  <span>
                    <img
                      src="/jk-monogram.svg"
                      alt=""
                      width="144"
                      height="112"
                    />
                    <Play fill="currentColor" size={12} />
                  </span>
                </span>
                <span>
                  <small>NO SEU RITMO. EM TODO LUGAR.</small>
                  <strong>
                    LEVE A JK HIPHOP <em>COM VOCÊ.</em>
                  </strong>
                  <span className="app-note">
                    O seu próximo app favorito. <b>EM BREVE</b>
                  </span>
                </span>
                <ArrowRight className="app-arrow" size={23} />
              </button>
            </BannerSlot>
            <BannerSlot slot="top" banners={banners}>
              <button className="ad-slot" onClick={() => contact(true)}>
                <span>ESPAÇO PUBLICITÁRIO</span>
                <strong>
                  SUA MARCA <ArrowUpRight /> AQUI
                </strong>
                <small>Conecte-se à nossa audiência</small>
              </button>
            </BannerSlot>
          </section>
          <section className="benefits" aria-label="O universo JK HipHop">
            {[
              {
                icon: Headphones,
                title: "RÁDIO 24H",
                copy: "O rap não tem hora",
              },
              {
                icon: Music2,
                title: "TODOS OS ESTILOS",
                copy: "Das raízes à nova escola",
              },
              {
                icon: Users,
                title: "NOSSA COMUNIDADE",
                copy: "Cultura que nos conecta",
              },
              {
                icon: Diamond,
                title: "SOM DE QUALIDADE",
                copy: "A essência em cada batida",
              },
            ].map(({ icon: Icon, title, copy }) => (
              <div className="benefit" key={title}>
                <Icon />
                <span>
                  <strong>{title}</strong>
                  <small>{copy}</small>
                </span>
              </div>
            ))}
          </section>
          <section className="content-section" id="programacao">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ENCONTRE A SUA BATIDA</span>
                <h2>
                  NA NOSSA <span>PROGRAMAÇÃO</span>
                </h2>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  open({
                    title: "Cada horário, uma nova conexão.",
                    eyebrow: "GRADE DEMONSTRATIVA",
                    body: (
                      <>
                        <p>
                          Esta é a proposta inicial da programação da JK HipHop.
                          Horários e programas serão confirmados antes da
                          estreia.
                        </p>
                        <div className="schedule-list">
                          {programs.map((item) => (
                            <button
                              key={item.title}
                              onClick={() => program(item)}
                            >
                              <span>
                                <b>{item.time}</b>
                                <strong>{item.title}</strong>
                              </span>
                              <span>
                                {item.days}
                                <ArrowRight size={16} />
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    ),
                  })
                }
              >
                VER PROGRAMAÇÃO <ArrowRight size={16} />
              </button>
            </div>
            <div className="program-grid">
              {programs.map((item, index) => (
                <button
                  className="program-card"
                  key={item.title}
                  onClick={() => program(item)}
                >
                  <img
                    src={`/images/${item.image}.webp`}
                    alt=""
                    loading="lazy"
                  />
                  <span className="card-shade" />
                  <span className="card-number">0{index + 1}</span>
                  <span className="program-card-content">
                    <span className="program-time">{item.time}</span>
                    <strong>{item.title}</strong>
                    <span className="tag">{item.days}</span>
                  </span>
                  <span className="card-arrow">
                    <ArrowRight size={17} />
                  </span>
                </button>
              ))}
            </div>
            <p className="demo-note">
              PROPOSTA DE PROGRAMAÇÃO · EM BREVE NA SUA FREQUÊNCIA
            </p>
          </section>
          <BannerSlot slot="main" banners={banners}>
            <section className="brand-banner" aria-label="Anuncie na JK HipHop">
              <div className="banner-image" />
              <Target className="banner-target" strokeWidth={1.4} />
              <div className="banner-copy">
                <span className="eyebrow">FAÇA PARTE DO MOVIMENTO</span>
                <h2>
                  SUA MARCA TEM
                  <br />
                  ESPAÇO <span>NA JK HIPHOP.</span>
                </h2>
                <p>Uma conexão real com quem vive a cultura.</p>
              </div>
              <button className="yellow-button" onClick={() => contact(true)}>
                ANUNCIE AQUI <ArrowRight size={19} />
              </button>
            </section>
          </BannerSlot>
          <section className="content-section playlist-section" id="playlists">
            <div className="section-heading">
              <div>
                <span className="eyebrow">APERTE O PLAY NO SEU ESTILO</span>
                <h2>
                  UNIVERSO <span>JK HIPHOP</span>
                </h2>
              </div>
              <div className="carousel-arrows">
                <button
                  className="icon-button"
                  aria-label="Playlists anteriores"
                  onClick={() =>
                    playlistTrack.current?.scrollBy({
                      left: -360,
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                    })
                  }
                >
                  <ChevronLeft size={19} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Próximas playlists"
                  onClick={() =>
                    playlistTrack.current?.scrollBy({
                      left: 360,
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                    })
                  }
                >
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>
            <div className="playlist-track" ref={playlistTrack}>
              {playlists.map((item) => (
                <button
                  className="playlist-card"
                  key={item.title}
                  onClick={() => playlist(item)}
                >
                  <div className="playlist-image">
                    <img
                      src={`/images/${item.image}.webp`}
                      alt=""
                      loading="lazy"
                    />
                    <span className="playlist-play">
                      <Play fill="currentColor" size={20} />
                    </span>
                    <span className="playlist-type">
                      <Music2 size={13} /> SELEÇÃO JK HIPHOP
                    </span>
                  </div>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </button>
              ))}
            </div>
          </section>
          <ListenerPoll />
          <NewsFeed open={open} />
        </div>
      </main>
      <footer className="footer">
        <div className="container footer-main">
          <div className="footer-brand">
            <a href="#inicio" aria-label="JK HipHop, início">
              <Brand />
            </a>
            <p>
              Mais que uma rádio, um movimento.
              <br />O rap em sua essência, conectando
              <br />
              pessoas, ideias e cultura.
            </p>
            <div className="footer-social">
              <button
                className="icon-button"
                aria-label="Instagram da JK HipHop"
                onClick={() => social("instagram")}
              >
                <Instagram size={19} />
              </button>
              <button
                className="icon-button"
                aria-label="YouTube da JK HipHop"
                onClick={() => social("youtube")}
              >
                <Youtube size={19} />
              </button>
              <button
                className="icon-button"
                aria-label="Contato da JK HipHop"
                onClick={() => contact()}
              >
                <Mail size={19} />
              </button>
            </div>
          </div>
          <div className="footer-links">
            <h3>EXPLORE A JK HIPHOP</h3>
            {navigation.map(([label, href]) => (
              <a key={label} href={href}>
                {label}
              </a>
            ))}
            <button onClick={about}>Sobre a rádio</button>
            <button onClick={() => contact()}>Contato</button>
          </div>
          <div className="footer-links">
            <h3>A SUA FREQUÊNCIA</h3>
            {playlists.slice(0, 5).map((item) => (
              <button key={item.title} onClick={() => playlist(item)}>
                {item.title}
              </button>
            ))}
            <button onClick={() => contact(true)}>Anuncie aqui</button>
          </div>
          <Newsletter openPrivacy={privacy} />
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} Web Rádio JK HipHop. Todos os direitos
            reservados.
          </span>
          <button onClick={privacy}>Privacidade</button>
          <span className="footer-manifesto">
            RAP É CULTURA. <b>RAP É RESISTÊNCIA.</b>
          </span>
        </div>
      </footer>
      <Modal content={modal} close={() => setModal(null)} />
    </>
  );
}

function ArrowUpRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}

function Instagram({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.7" cy="6.5" r=".6" fill="currentColor" />
    </svg>
  );
}
function Youtube({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
