import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download,
  ExternalLink,
  LoaderCircle,
  Mail,
  Menu,
  MessageCircle,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
  Vote,
  X,
} from "lucide-react";

function Instagram({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="18" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function Facebook() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14 22V13h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4A24 24 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v9Z" />
    </svg>
  );
}
function Youtube() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="m10 8 6 4-6 4Z" fill="#e90012" />
    </svg>
  );
}

type AppBanner = {
  id: string;
  title: string;
  alt_text: string;
  image_url: string;
  target_url: string | null;
  slot: "top" | "bottom";
  position: number;
};
type AppPoll = {
  id: string;
  question: string;
  status: string;
  total: number;
  ends_at: string | null;
  options: { id: string; label: string; votes: number }[];
};
type AppConfig = {
  settings: {
    radio_name: string;
    tagline: string;
    logo_url: string | null;
    background_url: string | null;
    show_poll: boolean;
    show_contact: boolean;
    banner_interval_seconds: number;
  };
  radio: {
    stream_url: string | null;
    instagram_url: string | null;
    youtube_url: string | null;
    facebook_url: string | null;
    tiktok_url: string | null;
    whatsapp_url: string | null;
    contact_email: string | null;
    contact_text: string | null;
  };
  banners: AppBanner[];
  poll: AppPoll | null;
  poll_available: boolean;
};

function safeHttps(value: unknown): string | null {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function AppLogo({
  config,
  name,
}: {
  config: AppConfig | null;
  name: string;
}) {
  const source = safeHttps(config?.settings.logo_url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [config, source]);
  return (
    <img
      src={(!failed && source) || "/logo-jk-hiphop.svg"}
      alt={name}
      onError={() => setFailed(true)}
    />
  );
}

function RotatingBanner({
  banners,
}: {
  banners: AppBanner[];
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    // A successful configuration refresh permits retrying transient image errors.
    setFailed((previous) => (previous.length ? [] : previous));
  }, [banners]);
  // Both legacy placements belong to the same carousel in the current app.
  const items = banners.filter(
    (item) =>
      !failed.includes(item.image_url) &&
      safeHttps(item.image_url),
  ).sort((a, b) => a.position - b.position);
  const signature = items.map((item) => item.id).join(":");
  useEffect(() => {
    setIndex(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    const schedule = () => {
      clearInterval(timer);
      if (!document.hidden && items.length > 1)
        timer = setInterval(
          () => setIndex((current) => (current + 1) % items.length),
          15000,
        );
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [signature]);
  const item = items[index % items.length];
  if (!item) return null;
  const image = (
    <img
      src={item.image_url}
      alt={item.alt_text || item.title}
      onError={() => setFailed((previous) => [...previous, item.image_url])}
    />
  );
  return (
    <section
      className="ra-ad"
      aria-label="Publicidade do aplicativo"
    >
      <span>
        PUBLICIDADE
        {items.length > 1
          ? ` · ${(index % items.length) + 1}/${items.length}`
          : ""}
      </span>
      {safeHttps(item.target_url) ? (
        <a
          href={safeHttps(item.target_url)!}
          target="_blank"
          rel="sponsored noopener noreferrer"
        >
          {image}
        </a>
      ) : (
        <div>{image}</div>
      )}
    </section>
  );
}

function AppDialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="ra-dialog"
      ref={dialog}
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button onClick={close} aria-label="Fechar">
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}

function Poll({
  poll,
  available,
}: {
  poll: AppPoll | null;
  available: boolean;
}) {
  const [current, setCurrent] = useState(poll),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [voted, setVoted] = useState(false);
  useEffect(() => setCurrent(poll), [poll]);
  useEffect(() => {
    if (!poll) return;
    try {
      setVoted(localStorage.getItem(`deluxe-vote:${poll.id}`) === "true");
    } catch {
      /* Cookies still protect the server vote. */
    }
  }, [poll?.id]);
  async function vote() {
    if (!current || !selected || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll_id: current.id, option_id: selected }),
      });
      const data = await response.json();
      if (!response.ok || !data.results)
        throw new Error(
          data.error || "Não foi possível votar. Tente novamente.",
        );
      setCurrent(data.results);
      setVoted(true);
      setMessage(
        data.already_voted
          ? "Seu voto já foi registrado nesta enquete."
          : "Voto registrado. Sua voz faz parte da JK HipHop!",
      );
      try {
        localStorage.setItem(`deluxe-vote:${current.id}`, "true");
      } catch {
        /* Server cookie remains authoritative. */
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível votar agora.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!available)
    return (
      <p>
        A enquete está temporariamente indisponível. Tente novamente em
        instantes.
      </p>
    );
  if (!current)
    return <p>A próxima enquete está chegando. Fique na frequência!</p>;
  const open =
    current.status === "active" &&
    (!current.ends_at || Date.parse(current.ends_at) > Date.now());
  return (
    <div className="ra-poll">
      <p className="ra-eyebrow">A SUA VOZ NA PROGRAMAÇÃO</p>
      <h3>{current.question}</h3>
      {voted || !open ? (
        <div>
          {current.options.map((option) => (
            <div className="ra-result" key={option.id}>
              <div>
                <span>{option.label}</span>
                <strong>
                  {current.total
                    ? Math.round((option.votes / current.total) * 100)
                    : 0}
                  %
                </strong>
              </div>
              <progress max={current.total || 1} value={option.votes} />
            </div>
          ))}
          <small>
            {current.total} votos registrados
            {!open ? " · Enquete encerrada" : ""}
          </small>
        </div>
      ) : (
        <fieldset>
          <legend>Escolha uma opção</legend>
          {current.options.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name="app-poll"
                value={option.id}
                checked={selected === option.id}
                onChange={() => setSelected(option.id)}
              />
              {option.label}
            </label>
          ))}
          <button
            className="ra-gold-button"
            disabled={!selected || busy}
            onClick={vote}
          >
            {busy ? "Registrando…" : "Confirmar voto"}
          </button>
        </fieldset>
      )}
      <p role="status">{message}</p>
      <small>Sem cadastro. Um voto por instalação ou navegador.</small>
    </div>
  );
}

export default function RadioApp() {
  const [config, setConfig] = useState<AppConfig | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [menu, setMenu] = useState(false),
    [panel, setPanel] = useState<"poll" | "contact" | null>(null);
  const [playing, setPlaying] = useState(false),
    [buffering, setBuffering] = useState(false),
    [audioError, setAudioError] = useState(""),
    [volume, setVolume] = useState(0.8);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/app", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (
          data.schema_version !== 1 ||
          !data.settings ||
          !Array.isArray(data.banners)
        )
          throw new Error();
        if (active) {
          setConfig(data);
          setError("");
        }
      } catch (issue) {
        if (
          active &&
          !(issue instanceof DOMException && issue.name === "AbortError")
        )
          setError(
            "Não foi possível atualizar a rádio. Verifique sua conexão.",
          );
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    const resume = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [refresh]);
  const stream = safeHttps(config?.radio.stream_url);
  useEffect(() => {
    audio.current?.pause();
    setPlaying(false);
    setBuffering(false);
    setAudioError("");
  }, [stream]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  async function toggle() {
    if (!stream || !audio.current) return;
    if (playing || buffering) {
      audio.current.pause();
      setBuffering(false);
      return;
    }
    setAudioError("");
    setBuffering(true);
    try {
      await audio.current.play();
    } catch {
      setBuffering(false);
      setAudioError(
        "Não foi possível reproduzir a transmissão. Tente novamente.",
      );
    }
  }
  const radio = config?.radio;
  const name = config?.settings.radio_name || "JK HipHop";
  const socials = [
    {
      label: "Instagram",
      url: radio?.instagram_url,
      icon: <Instagram />,
      className: "instagram",
    },
    {
      label: "Facebook",
      url: radio?.facebook_url,
      icon: <Facebook />,
      className: "facebook",
    },
    {
      label: "TikTok",
      url: radio?.tiktok_url,
      icon: <Music2 />,
      className: "tiktok",
    },
    {
      label: "YouTube",
      url: radio?.youtube_url,
      icon: <Youtube />,
      className: "youtube",
    },
    {
      label: "WhatsApp",
      url: radio?.whatsapp_url,
      icon: <MessageCircle />,
      className: "whatsapp",
    },
  ].filter((item) => safeHttps(item.url));
  return (
    <main
      className="radio-app"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.84), rgba(0,0,0,.68) 40%, #080909 85%), url("${safeHttps(config?.settings.background_url) || "/images/hero.webp"}")`,
      }}
    >
      <div className="ra-content">
        <header className="ra-header">
          <button
            className="ra-menu-button"
            aria-label="Abrir menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <AppLogo config={config} name={name} />
          <a href="/" aria-label="Visitar o site da rádio">
            <ExternalLink size={20} />
          </a>
        </header>
        {menu && (
          <nav className="ra-menu" aria-label="Menu do aplicativo">
            {config?.settings.show_poll && (
              <button
                onClick={() => {
                  setPanel("poll");
                  setMenu(false);
                }}
              >
                <Vote size={20} /> Enquete
              </button>
            )}
            {config?.settings.show_contact && (
              <button
                onClick={() => {
                  setPanel("contact");
                  setMenu(false);
                }}
              >
                <Mail size={20} /> Contato
              </button>
            )}
            <a href="/downloads/jk-hiphop.apk" download>
              <Download size={20} /> Baixar aplicativo Android
            </a>
            <a href="/privacidade">Política de privacidade</a>
          </nav>
        )}
        {error && (
          <div className="ra-alert" role="status">
            <span>{error}</span>
            <button
              onClick={() => setRefresh((value) => value + 1)}
              aria-label="Tentar atualizar"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        )}
        {!config && !error && (
          <p className="ra-connection" role="status">
            Carregando a rádio…
          </p>
        )}
        <RotatingBanner banners={config?.banners || []} />
        <section className="ra-player" aria-label="Player da rádio">
          <span
            className={`ra-stream-status ${playing ? "is-live" : ""}`}
            role="status"
          >
            {audioError ||
              (buffering
                ? "Conectando à transmissão…"
                : playing
                  ? "AO VIVO · VOCÊ ESTÁ NA FREQUÊNCIA"
                  : stream
                    ? "APERTE O PLAY. SINTA A BATIDA."
                    : "TRANSMISSÃO EM CONFIGURAÇÃO")}
          </span>
          <h1>{name}</h1>
          <p>{config?.settings.tagline || "O rap em alto nível."}</p>
          <label className="ra-volume">
            {volume === 0 ? (
              <VolumeX aria-hidden="true" />
            ) : (
              <Volume2 aria-hidden="true" />
            )}
            <span className="ra-sr-only">Volume da rádio</span>
            <input
              aria-label="Volume da rádio"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
            <Volume2 aria-hidden="true" />
          </label>
          <div className="ra-controls">
            {config?.settings.show_poll ? (
              <button className="ra-control" onClick={() => setPanel("poll")}>
                <Vote size={20} /> <span>Enquete</span>
              </button>
            ) : <span />}
            <button
              className="ra-play"
              onClick={toggle}
              disabled={!stream}
              aria-label={playing || buffering ? "Pausar rádio" : "Ouvir rádio"}
            >
              {buffering ? <LoaderCircle className="ra-spin" /> : playing ? (
                <Pause fill="currentColor" />
              ) : <Play fill="currentColor" />}
            </button>
            {config?.settings.show_contact ? (
              <button className="ra-control" onClick={() => setPanel("contact")}>
                <MessageCircle size={20} /> <span>Contato</span>
              </button>
            ) : <span />}
          </div>
        </section>
        {socials.length > 0 && (
          <section className="ra-socials" aria-label="Redes sociais da rádio">
            <div>
              {socials.map((item) => (
                <a
                  key={item.label}
                  className={item.className}
                  href={safeHttps(item.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${item.label} da rádio`}
                >
                  {item.icon}
                </a>
              ))}
            </div>
          </section>
        )}
        <footer className="ra-footer">
          <span>RAP. CULTURA. RESPEITO.</span>
          <a href="/downloads/jk-hiphop.apk" download>
            <Download size={15} /> Android
          </a>
        </footer>
      </div>
      <audio
        ref={audio}
        src={stream || undefined}
        preload="none"
        onPlaying={() => {
          setPlaying(true);
          setBuffering(false);
        }}
        onPause={() => {
          setPlaying(false);
          setBuffering(false);
        }}
        onWaiting={() => setBuffering(true)}
        onEnded={() => {
          setPlaying(false);
          setBuffering(false);
        }}
        onError={() => {
          if (stream)
            setAudioError("Transmissão indisponível. Tente novamente.");
          setPlaying(false);
          setBuffering(false);
        }}
      />
      {panel === "poll" && config?.settings.show_poll && (
        <AppDialog title="Enquete da rádio" close={() => setPanel(null)}>
          <Poll
            key={config.poll?.id || "none"}
            poll={config.poll}
            available={config.poll_available}
          />
        </AppDialog>
      )}
      {panel === "contact" && config?.settings.show_contact && (
        <AppDialog title="Fale com a rádio" close={() => setPanel(null)}>
          <p className="ra-contact-text">
            {radio?.contact_text ||
              "Entre na frequência com a gente pelos canais da rádio."}
          </p>
          <div className="ra-contact-links">
            {safeHttps(radio?.whatsapp_url) && (
              <a
                className="ra-gold-button"
                href={safeHttps(radio?.whatsapp_url)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={20} /> Conversar no WhatsApp
              </a>
            )}
            {radio?.contact_email &&
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(radio.contact_email) && (
                <a href={`mailto:${radio.contact_email}`}>
                  <Mail size={20} /> {radio.contact_email}
                </a>
              )}
            {safeHttps(radio?.instagram_url) && (
              <a
                href={safeHttps(radio?.instagram_url)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram size={20} /> Siga e mande sua mensagem
              </a>
            )}
          </div>
        </AppDialog>
      )}
    </main>
  );
}
