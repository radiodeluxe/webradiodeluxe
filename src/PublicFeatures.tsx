import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, CalendarDays, Check, Vote } from "lucide-react";
import { safeUrl, supabase } from "./lib";
import type { ModalContent } from "./App";

export type NewsPost = {
  id: string;
  title: string;
  body: string;
  category: string;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  source_author: string | null;
  source_published_at: string | null;
  origin: "manual" | "currents";
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  expires_at: string | null;
};
export type Poll = {
  id: string;
  question: string;
  status: string;
  ends_at: string | null;
  total: number;
  options: { id: string; label: string; votes: number }[];
};
export const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      })
    : "";
export function PollBars({ poll }: { poll: Poll }) {
  return (
    <div className="poll-results">
      {poll.options.map((option) => {
        const percent = poll.total
          ? Math.round((option.votes * 100) / poll.total)
          : 0;
        return (
          <div className="poll-result" key={option.id}>
            <div>
              <span>{option.label}</span>
              <strong>
                {percent}% <small>· {option.votes}</small>
              </strong>
            </div>
            <div className="poll-bar">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
      <p>
        {poll.total}{" "}
        {poll.total === 1 ? "voto registrado" : "votos registrados"}
      </p>
    </div>
  );
}
export function ListenerPoll() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("");
  const [results, setResults] = useState(false),
    [voted, setVoted] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setError("");
    setLoading(true);
    if (!supabase) {
      setError("A enquete está temporariamente indisponível.");
      setLoading(false);
      return;
    }
    const response = await supabase.rpc("poll_results");
    if (response.error) setError("Não foi possível carregar a enquete.");
    else {
      setPoll(response.data);
      if (response.data) {
        try {
          const done =
            localStorage.getItem(`deluxe-vote:${response.data.id}`) === "true";
          setVoted(done);
          setResults(done);
        } catch {}
      }
    }
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  async function vote() {
    if (!poll || !selected || busy || voted) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll_id: poll.id, option_id: selected }),
      });
      const data = await response.json();
      if (!response.ok || !data.results)
        throw new Error(data.error || "Não foi possível votar agora.");
      setPoll(data.results);
      setVoted(true);
      setResults(true);
      setMessage(
        data.already_voted
          ? "Seu voto já foi registrado nesta enquete."
          : "Voto registrado. Sua voz faz parte da Deluxe!",
      );
      try {
        localStorage.setItem(`deluxe-vote:${poll.id}`, "true");
      } catch {}
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível votar agora. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="listener-poll content-section"
      id="enquete"
      aria-labelledby="poll-title"
    >
      <div className="poll-intro">
        <span className="eyebrow">
          <Vote size={16} /> A SUA VOZ NA PROGRAMAÇÃO
        </span>
        <h2 id="poll-title">
          QUEM ESCOLHE
          <br />
          <span>É VOCÊ.</span>
        </h2>
        <p>
          Ajude a dar o tom da nossa frequência. Vote no som que você quer ouvir
          por aqui.
        </p>
        <span className="poll-note">Sem cadastro. Um voto por navegador.</span>
      </div>
      <div className="poll-panel">
        {loading ? (
          <p role="status">Carregando enquete…</p>
        ) : error ? (
          <>
            <p role="alert">{error}</p>
            <button className="outline-button" onClick={load}>
              Tentar novamente
            </button>
          </>
        ) : !poll ? (
          <p>A próxima enquete está chegando. Fique na frequência!</p>
        ) : (
          <>
            <span className="live-status ready">
              <i /> ENQUETE DOS OUVINTES
            </span>
            <h3>{poll.question}</h3>
            {poll.ends_at && <small>Até {formatDate(poll.ends_at)}</small>}
            {results ? (
              <PollBars poll={poll} />
            ) : (
              <fieldset className="poll-options">
                <legend className="sr-only">Escolha seu estilo</legend>
                {poll.options.map((option) => (
                  <label
                    className={selected === option.id ? "selected" : ""}
                    key={option.id}
                  >
                    <input
                      type="radio"
                      name="listener-choice"
                      value={option.id}
                      checked={selected === option.id}
                      onChange={() => setSelected(option.id)}
                      disabled={busy || voted}
                    />
                    <span>{option.label}</span>
                    {selected === option.id && <Check size={17} />}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="poll-actions">
              {!voted && (
                <button
                  className="yellow-button"
                  disabled={!selected || busy}
                  onClick={vote}
                >
                  {busy ? "Registrando…" : "Registrar meu voto"}
                  <ArrowRight size={16} />
                </button>
              )}
              <button
                className="text-action"
                onClick={() => setResults((value) => !value)}
                disabled={voted || busy}
              >
                <BarChart3 size={16} />
                {results ? "Voltar às opções" : "Ver resultados"}
              </button>
            </div>
            <p role="status" className="poll-message">
              {message ||
                (voted
                  ? "Seu voto já está registrado. Obrigado por participar!"
                  : "")}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export function NewsFeed({ open }: { open: (content: ModalContent) => void }) {
  const [posts, setPosts] = useState<NewsPost[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [all, setAll] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) {
        if (mounted) {
          setError("As notícias estão temporariamente indisponíveis.");
          setLoading(false);
        }
        return;
      }
      const response = await supabase
        .from("news_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(30);
      if (mounted) {
        setLoading(false);
        if (response.error)
          setError(
            "Não foi possível carregar as notícias. Tente atualizar a página.",
          );
        else {
          setPosts(response.data || []);
          setError("");
        }
      }
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  function show(post: NewsPost) {
    const source = safeUrl(post.source_url);
    open({
      title: post.title,
      eyebrow: `${post.category} · ${formatDate(post.published_at)}`,
      body: (
        <>
          <img
            className="modal-image"
            src={safeUrl(post.image_url) || "/images/battle.webp"}
            alt=""
          />
          {!safeUrl(post.image_url) && (
            <small className="source-attribution">Imagem ilustrativa da Deluxe</small>
          )}
          {post.body ? (
            post.body
              .split("\n")
              .filter(Boolean)
              .map((paragraph, i) => <p key={i}>{paragraph}</p>)
          ) : (
            <p>
              Confira esta notícia de música em português no veículo responsável
              pela publicação.
            </p>
          )}
          {post.source_name && (
            <p className="source-attribution">
              Fonte: {post.source_name}
              {post.source_author ? ` · ${post.source_author}` : ""}
              {post.source_published_at
                ? ` · ${formatDate(post.source_published_at)}`
                : ""}
            </p>
          )}
          {source && (
            <a
              className="yellow-button"
              href={source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ler na fonte original <ArrowRight size={16} />
            </a>
          )}
          {post.origin === "currents" && (
            <p className="source-attribution">
              Powered by{" "}
              <a
                href="https://currentsapi.services"
                target="_blank"
                rel="noopener noreferrer"
              >
                Currents News API
              </a>
            </p>
          )}
        </>
      ),
    });
  }
  return (
    <section className="content-section news-section" id="noticias">
      <div className="section-heading">
        <div>
          <span className="eyebrow">O QUE MOVE A CULTURA</span>
          <h2>
            DIRETO <span>DA CENA</span>
          </h2>
        </div>
        <button className="text-action" onClick={() => setAll((v) => !v)}>
          {all ? "Ver recentes" : "Ver todas"}
          <ArrowRight size={16} />
        </button>
      </div>
      {loading ? (
        <p role="status" className="empty-state">
          Buscando as últimas notícias…
        </p>
      ) : error ? (
        <p role="alert" className="empty-state">
          {error}
        </p>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <strong>A cena não para.</strong>
          <p>As próximas notícias de música chegam por aqui em breve.</p>
        </div>
      ) : (
        <div className="news-grid">
          {posts.slice(0, all ? 30 : 6).map((post, i) => (
            <button
              className="news-card"
              key={post.id}
              onClick={() => show(post)}
            >
              <div className="news-image">
                <img
                  src={
                    safeUrl(post.image_url) ||
                    `/images/${["battle", "city", "vinyl"][i % 3]}.webp`
                  }
                  alt=""
                  loading="lazy"
                />
                <span className="tag">{post.category}</span>
                {!safeUrl(post.image_url) && (
                  <small className="news-illustration">Imagem ilustrativa</small>
                )}
              </div>
              <div className="news-content">
                <h3>{post.title}</h3>
                <div>
                  <span>
                    <CalendarDays size={13} />
                    {formatDate(post.published_at)}
                  </span>
                  <ArrowRight size={17} />
                </div>
                <small className="source-attribution">
                  {post.source_name || "Redação Deluxe"}
                </small>
              </div>
            </button>
          ))}
        </div>
      )}
      {posts.some((p) => p.origin === "currents") && (
        <p className="news-credit">
          Powered by{" "}
          <a
            href="https://currentsapi.services"
            target="_blank"
            rel="noopener noreferrer"
          >
            Currents News API
          </a>{" "}
          · Chamadas com acesso à fonte original.
        </p>
      )}
    </section>
  );
}
