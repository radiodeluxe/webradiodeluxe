import { createClient, type Session } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { LoadingState, useScrollReveal } from "./Motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Headphones,
  Image,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Vote,
  X,
} from "lucide-react";
import { Brand } from "./App";
import {
  PollBars,
  formatDate,
  type NewsPost,
  type Poll,
} from "./PublicFeatures";
import type { RadioSettings } from "./lib";
import "./admin.css";
import BannerManager from "./AdminBanners";
import type { Banner } from "./Advertising";

const client = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: window.sessionStorage,
      storageKey: "deluxe-master-session",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
type Section =
  | "dashboard"
  | "news"
  | "polls"
  | "banners"
  | "radio"
  | "subscribers"
  | "settings";
const modules = [
  { id: "dashboard", label: "Painel principal", icon: LayoutDashboard },
  { id: "news", label: "Notícias", icon: Newspaper },
  { id: "polls", label: "Enquetes", icon: Vote },
  { id: "banners", label: "Banners", icon: Image },
  { id: "radio", label: "Player / transmissão", icon: Headphones },
  { id: "subscribers", label: "Newsletter", icon: Mail },
  { id: "settings", label: "Configurações", icon: Settings },
] as const;
type Automation = {
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_message: string | null;
};
type ImportLog = {
  id: string;
  started_at: string;
  status: string;
  published_count: number;
  message: string | null;
};
type Subscriber = { id: string; email: string; created_at: string };
const statusName: Record<string, string> = {
  published: "Publicado",
  draft: "Rascunho",
  archived: "Arquivado",
  active: "Ativa",
  closed: "Encerrada",
  success: "Concluído",
  warning: "Atenção",
  running: "Em andamento",
};
function Badge({ value }: { value: string }) {
  return (
    <span className={`admin-badge ${value}`}>{statusName[value] || value}</span>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Login({ onSession }: { onSession: (session: Session) => void }) {
  const [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await client.auth.signInWithPassword({
      email: "cesarideadigital@gmail.com",
      password,
    });
    setPassword("");
    setBusy(false);
    if (result.error || !result.data.session)
      setError("Não foi possível entrar. Verifique a senha e tente novamente.");
    else onSession(result.data.session);
  }
  return (
    <div className="admin-login page-enter">
      <div className="login-art">
        <Brand large />
        <span className="eyebrow">A CULTURA TEM VOZ.</span>
        <h1>
          O controle da
          <br />
          <span>sua frequência.</span>
        </h1>
        <p>
          Conteúdo, comunidade e música.
          <br />
          Tudo conectado na Deluxe.
        </p>
        <a href="/" className="outline-button">
          Voltar ao site <ArrowRight size={17} />
        </a>
      </div>
      <div className="login-panel">
        <span className="admin-lock">
          <ShieldCheck size={24} />
        </span>
        <span className="eyebrow">ACESSO EXCLUSIVO</span>
        <h2>
          Bem-vindo,
          <br />
          administrador.
        </h2>
        <p>Entre para gerenciar a Web Rádio Deluxe.</p>
        <form onSubmit={submit}>
          <Field label="E-mail do administrador">
            <input
              type="email"
              value="cesarideadigital@gmail.com"
              readOnly
              autoComplete="username"
            />
          </Field>
          <Field label="Senha">
            <span className="password-input">
              <input
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </Field>
          <button className="yellow-button" disabled={busy}>
            {busy ? "Entrando…" : "Entrar no painel"}
            <ArrowRight size={17} />
          </button>
          <p className="admin-message error" role="alert">
            {error}
          </p>
        </form>
        <span className="login-footnote">
          <ShieldCheck size={14} /> Área reservada ao administrador master.
        </span>
      </div>
    </div>
  );
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [allowed, setAllowed] = useState(false),
    [authError, setAuthError] = useState("");
  useEffect(() => {
    document.title = "Admin Master | Web Rádio Deluxe";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.append(meta);
    void client.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      setReady(!data.session);
      if (error) setAuthError("Sua sessão expirou. Entre novamente.");
    });
    const { data } = client.auth.onAuthStateChange((_event, current) => {
      setSession(current);
      if (!current) {
        setAllowed(false);
        setReady(true);
      }
    });
    return () => {
      data.subscription.unsubscribe();
      meta.remove();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setAllowed(false);
    if (!session) {
      setReady(true);
      return;
    }
    setReady(false);
    async function verify() {
      const response = await client.rpc("admin_access");
      if (!active) return;
      if (response.error || response.data !== true) {
        setAuthError(
          "Acesso exclusivo do administrador master. Entre novamente.",
        );
        await client.auth.signOut();
        setSession(null);
      } else {
        setAllowed(true);
        setAuthError("");
      }
      setReady(true);
    }
    void verify();
    return () => {
      active = false;
    };
  }, [session?.access_token]);
  if (!ready) return <LoadingState fullscreen label="Validando acesso…" />;
  if (!session || !allowed)
    return (
      <>
        <Login onSession={setSession} />
        {authError && (
          <p className="admin-auth-error" role="alert">
            {authError}
          </p>
        )}
      </>
    );
  return <Panel email={session.user.email || ""} />;
}

function Panel({ email }: { email: string }) {
  const [section, setSection] = useState<Section>("dashboard"),
    [menu, setMenu] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const motionRoot = useRef<HTMLElement>(null);
  useScrollReveal(motionRoot, section);
  const [news, setNews] = useState<NewsPost[]>([]),
    [banners, setBanners] = useState<Banner[]>([]),
    [polls, setPolls] = useState<Poll[]>([]),
    [settings, setSettings] = useState<RadioSettings | null>(null),
    [automation, setAutomation] = useState<Automation | null>(null),
    [logs, setLogs] = useState<ImportLog[]>([]),
    [subscribers, setSubscribers] = useState<Subscriber[]>([]),
    [subscriberCount, setSubscriberCount] = useState(0),
    [publishedCount, setPublishedCount] = useState(0),
    [search, setSearch] = useState("");
  const [editingNews, setEditingNews] = useState<NewsPost | null | undefined>(
      undefined,
    ),
    [editingPoll, setEditingPoll] = useState<Poll | null | undefined>(
      undefined,
    ),
    [importing, setImporting] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const access = await client.rpc("admin_access");
    if (access.error || access.data !== true) {
      await client.auth.signOut();
      return;
    }
    const responses = await Promise.all([
      client
        .from("news_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      client
        .from("polls")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("radio_settings")
        .select("stream_url,instagram_url,youtube_url,contact_email")
        .eq("id", 1)
        .single(),
      client
        .from("news_automation")
        .select("enabled,last_run_at,last_status,last_message")
        .eq("id", 1)
        .single(),
      client
        .from("news_import_log")
        .select("id,started_at,status,published_count,message")
        .order("started_at", { ascending: false })
        .limit(12),
      client
        .from("newsletter_subscribers")
        .select("id,email,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(200),
      client
        .from("news_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      client.from("ad_banners").select("*").order("id"),
    ]);
    if (responses.some((r) => r.error)) {
      setError("Não foi possível carregar todos os dados. Tente atualizar.");
      setLoading(false);
      return;
    }
    setNews((responses[0].data || []) as unknown as NewsPost[]);
    setSettings(responses[2].data as unknown as RadioSettings);
    setAutomation(responses[3].data as unknown as Automation);
    setLogs((responses[4].data || []) as unknown as ImportLog[]);
    setSubscribers((responses[5].data || []) as unknown as Subscriber[]);
    setSubscriberCount(responses[5].count || 0);
    setPublishedCount(responses[6].count || 0);
    setBanners((responses[7].data || []) as unknown as Banner[]);
    const results = await Promise.all(
      (responses[1].data || []).map((p) =>
        client.rpc("poll_results", { p_id: (p as { id: string }).id }),
      ),
    );
    if (results.some((r) => r.error))
      setError("Não foi possível carregar os resultados das enquetes.");
    setPolls(results.filter((r) => r.data).map((r) => r.data));
    setLoading(false);
  }, []);
  useEffect(() => {
    void reload();
    const verify = () => {
      void client.rpc("admin_access").then((response) => {
        if (response.error || response.data !== true)
          void client.auth.signOut();
      });
    };
    window.addEventListener("focus", verify);
    return () => window.removeEventListener("focus", verify);
  }, [reload]);
  function navigate(next: Section) {
    window.scrollTo({ top: 0, behavior: "instant" });
    setSection(next);
    setMenu(false);
    setEditingNews(undefined);
    setEditingPoll(undefined);
    setNotice("");
  }
  async function imported() {
    setImporting(true);
    setNotice("");
    const { data, error } = await client.functions.invoke("music-news", {
      body: {},
    });
    setImporting(false);
    if (error) {
      let message =
        "A importação não foi concluída. Confira o histórico e tente novamente no próximo horário.";
      try {
        const response = await error.context?.json();
        if (response?.message) message = response.message;
      } catch {}
      setNotice(message);
    } else
      setNotice(
        `${data.message} ${data.published ? `${data.published} publicação(ões).` : ""}`,
      );
    await reload();
  }
  async function toggleAutomation() {
    if (!automation) return;
    const response = await client
      .from("news_automation")
      .update({ enabled: !automation.enabled })
      .eq("id", 1)
      .select("enabled")
      .single();
    if (response.error) setNotice("Não foi possível alterar a automação.");
    else {
      setAutomation({ ...automation, enabled: response.data.enabled });
      setNotice(
        response.data.enabled ? "Automação ativada." : "Automação pausada.",
      );
    }
  }
  const activePoll = polls.find(
    (p) =>
      p.status === "active" && (!p.ends_at || new Date(p.ends_at) > new Date()),
  );
  const filteredNews = news.filter((p) =>
    `${p.title} ${p.category}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const current = modules.find((m) => m.id === section)!;
  function saved() {
    setEditingNews(undefined);
    setEditingPoll(undefined);
    setNotice("Alterações salvas.");
    void reload();
  }
  async function signOut() {
    await client.auth.signOut();
    window.sessionStorage.removeItem("deluxe-master-session");
  }
  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menu ? "open" : ""}`}>
        <a className="admin-brand" href="/" aria-label="Deluxe, início">
          <Brand />
        </a>
        <span className="sidebar-caption">CENTRAL DA RÁDIO</span>
        <nav aria-label="Navegação administrativa">
          {modules.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} />
              {item.label}
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={22} />
          <strong>Admin master</strong>
          <span>Acesso exclusivo</span>
        </div>
        <button className="admin-logout" onClick={signOut}>
          <LogOut size={16} /> Sair do painel
        </button>
      </aside>
      {menu && (
        <button
          className="admin-backdrop"
          onClick={() => setMenu(false)}
          aria-label="Fechar menu"
        />
      )}
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            className="icon-button admin-menu-button"
            aria-label="Abrir menu administrativo"
            onClick={() => setMenu((v) => !v)}
          >
            <Menu size={21} />
          </button>
          <div className="admin-search">
            <Search size={17} />
            <input
              aria-label="Pesquisar notícias no painel"
              placeholder="Pesquisar notícias…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSection("news");
                setEditingNews(undefined);
              }}
            />
          </div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-site-link"
          >
            Ver site <ExternalLink size={15} />
          </a>
          <a
            href="/#player"
            target="_blank"
            rel="noopener noreferrer"
            className="yellow-button admin-listen"
          >
            <Play size={14} fill="currentColor" /> Ouvir rádio
          </a>
          <div className="admin-profile">
            <span>C</span>
            <div>
              <strong>Admin</strong>
              <small>Administrador master</small>
            </div>
          </div>
        </header>
        <main
          key={section}
          className="admin-content page-enter"
          ref={motionRoot}
          aria-busy={loading}
        >
          <div className="admin-page-heading">
            <div>
              <span className="eyebrow">DELUXE / CENTRAL DE CONTROLE</span>
              <h1>{current.label}</h1>
            </div>
            <button
              className="outline-button"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />{" "}
              Atualizar
            </button>
          </div>
          {loading && <LoadingState label="Atualizando painel…" />}
          {section === "banners" && (
            <BannerManager client={client} banners={banners} saved={saved} />
          )}
          {error && (
            <p className="admin-message error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="admin-message" role="status">
              {notice}
            </p>
          )}
          {section === "dashboard" && (
            <>
              <div className="admin-welcome">
                <div>
                  <span className="eyebrow">A FREQUÊNCIA É SUA.</span>
                  <h2>Bem-vindo, Admin!</h2>
                  <p>Gerencie o conteúdo e ouça a sua comunidade.</p>
                  <button
                    className="yellow-button"
                    onClick={() => navigate("news")}
                  >
                    Gerenciar notícias <ArrowRight size={16} />
                  </button>
                </div>
                <Brand large />
              </div>
              <div className="admin-metrics">
                {[
                  {
                    label: "Notícias publicadas",
                    value: publishedCount,
                    icon: Newspaper,
                    color: "yellow",
                  },
                  {
                    label: "Enquetes cadastradas",
                    value: polls.length,
                    icon: Vote,
                    color: "purple",
                  },
                  {
                    label: "Votos na enquete atual",
                    value: activePoll?.total || 0,
                    icon: BarChart3,
                    color: "green",
                  },
                  {
                    label: "Inscritos na newsletter",
                    value: subscriberCount,
                    icon: Mail,
                    color: "blue",
                  },
                ].map((item) => (
                  <div
                    className={`admin-metric ${item.color}`}
                    key={item.label}
                  >
                    <item.icon size={22} />
                    <div>
                      <span>{item.label}</span>
                      <strong>
                        {loading ? "—" : item.value.toLocaleString("pt-BR")}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
              <div className="admin-dashboard-grid">
                <section className="admin-card">
                  <div className="admin-card-heading">
                    <h2>
                      <Newspaper size={19} /> Últimas notícias
                    </h2>
                    <button
                      className="text-action"
                      onClick={() => navigate("news")}
                    >
                      Gerenciar <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="admin-recent-news">
                    {news.slice(0, 4).map((post) => (
                      <button
                        key={post.id}
                        onClick={() => {
                          navigate("news");
                          setEditingNews(post);
                        }}
                      >
                        <img
                          src={post.image_url || "/images/battle.webp"}
                          alt=""
                        />
                        <span>
                          <strong>{post.title}</strong>
                          <small>
                            {post.origin === "currents"
                              ? "Currents API"
                              : "Redação Deluxe"}{" "}
                            · {formatDate(post.created_at)}
                          </small>
                        </span>
                        <Badge value={post.status} />
                      </button>
                    ))}
                    {!loading && news.length === 0 && (
                      <p className="admin-empty">
                        As primeiras notícias aparecerão aqui.
                      </p>
                    )}
                  </div>
                </section>
                <section className="admin-card">
                  <div className="admin-card-heading">
                    <h2>
                      <Vote size={19} /> Voz dos ouvintes
                    </h2>
                    <button
                      className="text-action"
                      onClick={() => navigate("polls")}
                    >
                      Gerenciar <ArrowRight size={15} />
                    </button>
                  </div>
                  {activePoll ? (
                    <>
                      <h3 className="admin-poll-title">
                        {activePoll.question}
                      </h3>
                      <PollBars poll={activePoll} />
                    </>
                  ) : (
                    <p className="admin-empty">Nenhuma enquete ativa.</p>
                  )}
                </section>
                <AutomationCard
                  automation={automation}
                  logs={logs.slice(0, 3)}
                  importing={importing}
                  imported={imported}
                  toggle={toggleAutomation}
                />
                <section className="admin-card admin-radio-summary">
                  <Headphones size={32} />
                  <h2>A rádio na sua frequência.</h2>
                  <p>
                    {settings?.stream_url
                      ? "Transmissão configurada. Abra o player para testar a conexão."
                      : "Adicione o endereço de streaming para ativar o player do site."}
                  </p>
                  <button
                    className="outline-button"
                    onClick={() => navigate("radio")}
                  >
                    Configurar transmissão <ArrowRight size={15} />
                  </button>
                </section>
              </div>
            </>
          )}
          {section === "news" && (
            <>
              {editingNews !== undefined ? (
                <NewsEditor
                  post={editingNews}
                  saved={saved}
                  cancel={() => setEditingNews(undefined)}
                />
              ) : (
                <>
                  <AutomationCard
                    automation={automation}
                    logs={logs}
                    importing={importing}
                    imported={imported}
                    toggle={toggleAutomation}
                  />
                  <section className="admin-card">
                    <div className="admin-card-heading">
                      <h2>
                        Publicações{" "}
                        <span className="admin-count">{news.length}</span>
                      </h2>
                      <button
                        className="yellow-button"
                        onClick={() => setEditingNews(null)}
                      >
                        <Plus size={16} /> Nova notícia
                      </button>
                    </div>
                    <p className="admin-table-note">
                      Últimas 200 publicações. Notícias da API permanecem
                      disponíveis por sete dias.
                    </p>
                    <div className="admin-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Título / categoria</th>
                            <th>Origem</th>
                            <th>Data</th>
                            <th>Status</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredNews.map((post) => (
                            <tr key={post.id}>
                              <td>
                                <strong>{post.title}</strong>
                                <small>{post.category}</small>
                              </td>
                              <td>
                                {post.origin === "currents"
                                  ? "Currents API"
                                  : "Manual"}
                              </td>
                              <td>{formatDate(post.created_at)}</td>
                              <td>
                                <Badge value={post.status} />
                              </td>
                              <td>
                                <button
                                  className="outline-button compact"
                                  onClick={() => setEditingNews(post)}
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!loading && filteredNews.length === 0 && (
                      <p className="admin-empty">Nenhuma notícia encontrada.</p>
                    )}
                  </section>
                </>
              )}
            </>
          )}
          {section === "polls" && (
            <>
              {editingPoll !== undefined ? (
                <PollEditor
                  poll={editingPoll}
                  saved={saved}
                  cancel={() => setEditingPoll(undefined)}
                />
              ) : (
                <section className="admin-card">
                  <div className="admin-card-heading">
                    <h2>
                      <Vote size={19} /> Enquetes dos ouvintes
                    </h2>
                    <button
                      className="yellow-button"
                      onClick={() => setEditingPoll(null)}
                    >
                      <Plus size={16} /> Nova enquete
                    </button>
                  </div>
                  <p className="admin-table-note">
                    Uma enquete ativa por vez. Ao ativar outra, a anterior é
                    encerrada e seus resultados são preservados.
                  </p>
                  <div className="admin-poll-grid">
                    {polls.map((poll) => (
                      <div className="admin-poll-item" key={poll.id}>
                        <Badge value={poll.status} />
                        <h3>{poll.question}</h3>
                        {poll.ends_at && (
                          <small>
                            Encerramento: {formatDate(poll.ends_at)}
                          </small>
                        )}
                        <PollBars poll={poll} />
                        <button
                          className="outline-button"
                          onClick={() => setEditingPoll(poll)}
                        >
                          Editar / encerrar <ArrowRight size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!loading && polls.length === 0 && (
                    <p className="admin-empty">Crie a primeira enquete.</p>
                  )}
                </section>
              )}
            </>
          )}
          {(section === "radio" || section === "settings") && settings && (
            <SettingsEditor
              settings={settings}
              radio={section === "radio"}
              saved={saved}
            />
          )}
          {section === "settings" && (
            <section className="admin-card admin-account">
              <div className="admin-card-heading">
                <h2>
                  <ShieldCheck size={19} /> Conta master
                </h2>
              </div>
              <p>{email}</p>
              <p>
                O site oferece acesso administrativo exclusivo. Os ouvintes
                participam da enquete e da newsletter sem criar uma conta.
              </p>
              <PasswordForm />
            </section>
          )}
          {section === "subscribers" && (
            <section className="admin-card">
              <div className="admin-card-heading">
                <h2>
                  <Mail size={19} /> Newsletter
                </h2>
                <button
                  className="outline-button"
                  disabled={!subscribers.length}
                  onClick={() => {
                    const cell = (value: string) => {
                      const safe = /^[=+@\-\t\r]/.test(value)
                        ? `'${value}`
                        : value;
                      return `"${safe.replaceAll('"', '""')}"`;
                    };
                    const csv =
                      "E-mail;Cadastro\r\n" +
                      subscribers
                        .map((s) => `${cell(s.email)};${cell(s.created_at)}`)
                        .join("\r\n");
                    const blob = new Blob(["\uFEFF" + csv], {
                      type: "text/csv;charset=utf-8",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "deluxe-newsletter.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Exportar últimos 200
                </button>
              </div>
              <p className="admin-table-note">
                {subscriberCount} inscritos com consentimento. Exibindo os
                últimos {subscribers.length}.
              </p>
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>E-mail</th>
                      <th>Cadastro</th>
                      <th>Consentimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s) => (
                      <tr key={s.id}>
                        <td>{s.email}</td>
                        <td>{formatDate(s.created_at)}</td>
                        <td>
                          <span className="admin-badge active">
                            <Check size={12} /> Confirmado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!loading && !subscribers.length && (
                <p className="admin-empty">Nenhuma inscrição recebida ainda.</p>
              )}
            </section>
          )}
        </main>
        <footer className="admin-footer">
          <span>© {new Date().getFullYear()} Web Rádio Deluxe</span>
          <span>RAP É CULTURA. RESPEITO É A BASE.</span>
        </footer>
      </div>
    </div>
  );
}

function AutomationCard({
  automation,
  logs,
  importing,
  imported,
  toggle,
}: {
  automation: Automation | null;
  logs: ImportLog[];
  importing: boolean;
  imported: () => void;
  toggle: () => void;
}) {
  return (
    <section className="admin-card automation-card">
      <div className="admin-card-heading">
        <h2>
          <RefreshCw size={19} /> Notícias automáticas
        </h2>
        <span
          className={`admin-badge ${automation?.enabled ? "active" : "closed"}`}
        >
          {automation?.enabled ? "Ativada" : "Pausada"}
        </span>
      </div>
      <div className="automation-description">
        <div>
          <strong>3 notícias de música por dia</strong>
          <p>Português · 9h, 15h e 21h · Horário de Brasília</p>
          <small>
            Chamadas com fonte e link original. Repetições são descartadas. Se a
            API estiver indisponível, uma nova tentativa ocorre uma hora depois.
          </small>
        </div>
        <div className="automation-actions">
          <button
            className="outline-button"
            onClick={toggle}
            disabled={!automation || importing}
          >
            {automation?.enabled ? "Pausar automação" : "Ativar automação"}
          </button>
          <button
            className="yellow-button"
            onClick={imported}
            disabled={importing || !automation?.enabled}
          >
            <RefreshCw size={15} className={importing ? "spin" : ""} />
            {importing ? "Importando…" : "Buscar agora"}
          </button>
        </div>
      </div>
      {automation?.last_message && (
        <p
          className={`automation-last ${automation.last_status === "warning" ? "warning" : ""}`}
        >
          {automation.last_message}
        </p>
      )}
      {logs.length > 0 && (
        <details className="automation-history">
          <summary>Histórico de importações ({logs.length})</summary>
          {logs.map((log) => (
            <div key={log.id}>
              <span>
                {new Date(log.started_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
              <Badge value={log.status} />
              <strong>{log.published_count} publicações</strong>
              <p>{log.message || "Importação em andamento"}</p>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function NewsEditor({
  post,
  saved,
  cancel,
}: {
  post: NewsPost | null;
  saved: () => void;
  cancel: () => void;
}) {
  const [title, setTitle] = useState(post?.title || ""),
    [body, setBody] = useState(post?.body || ""),
    [category, setCategory] = useState(post?.category || "Música"),
    [status, setStatus] = useState(post?.status || "draft"),
    [image, setImage] = useState(post?.image_url || ""),
    [source, setSource] = useState(post?.source_url || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = {
      title: title.trim(),
      body: post?.origin === "currents" ? "" : body.trim(),
      category: category.trim(),
      status,
      image_url: image.trim() || null,
      source_url: source.trim() || null,
      source_name:
        post?.source_name || (source ? new URL(source).hostname : null),
      published_at:
        status === "published"
          ? post?.published_at || new Date().toISOString()
          : post?.published_at || null,
      updated_at: new Date().toISOString(),
    };
    const response = post
      ? await client
          .from("news_posts")
          .update(data)
          .eq("id", post.id)
          .select("id")
          .single()
      : await client.from("news_posts").insert(data).select("id").single();
    setBusy(false);
    if (response.error)
      setError(
        "Não foi possível salvar. Verifique os campos e se o link já foi publicado.",
      );
    else saved();
  }
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>{post ? "Editar notícia" : "Nova notícia"}</h2>
        <button
          className="icon-button"
          aria-label="Fechar edição"
          onClick={cancel}
        >
          <X size={20} />
        </button>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <Field label="Título">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={240}
          />
        </Field>
        <div className="admin-form-row">
          <Field label="Categoria">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              maxLength={60}
            />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as NewsPost["status"])}
            >
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </Field>
        </div>
        <Field label="Texto da publicação">
          <textarea
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={20000}
            disabled={post?.origin === "currents"}
          />
        </Field>
        {post?.origin === "currents" && (
          <p className="admin-table-note">
            Esta chamada da API direciona para o artigo original e mantém a
            fonte e o autor.
          </p>
        )}
        <Field label="Imagem (URL HTTPS, opcional)">
          <input
            type="url"
            pattern="https://.*"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
        </Field>
        <Field label="Link da fonte (URL HTTPS, opcional)">
          <input
            type="url"
            pattern="https://.*"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            readOnly={post?.origin === "currents"}
          />
        </Field>
        <p role="alert" className="admin-message error">
          {error}
        </p>
        <div className="admin-form-actions">
          <button className="yellow-button" disabled={busy}>
            {busy ? "Salvando…" : "Salvar notícia"}
            <Check size={16} />
          </button>
          <button
            type="button"
            className="outline-button"
            onClick={cancel}
            disabled={busy}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

function PollEditor({
  poll,
  saved,
  cancel,
}: {
  poll: Poll | null;
  saved: () => void;
  cancel: () => void;
}) {
  const [question, setQuestion] = useState(poll?.question || ""),
    [choices, setChoices] = useState(
      poll?.options.map((o) => o.label).join("\n") || "",
    ),
    [status, setStatus] = useState(poll?.status || "draft"),
    [end, setEnd] = useState(
      poll?.ends_at
        ? new Date(
            new Date(poll.ends_at).getTime() -
              new Date(poll.ends_at).getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, 16)
        : "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const options = choices
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      options.length < 2 ||
      options.length > 6 ||
      new Set(options.map((s) => s.toLocaleLowerCase())).size !== options.length
    ) {
      setError("Informe de 2 a 6 opções diferentes, uma por linha.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await client.rpc("manage_poll", {
      p_id: poll?.id || null,
      p_question: question.trim(),
      p_options: options,
      p_status: status,
      p_ends_at: end ? new Date(end).toISOString() : null,
    });
    setBusy(false);
    if (response.error)
      setError(
        "Não foi possível salvar. Confira as opções e a data de encerramento.",
      );
    else saved();
  }
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>{poll ? "Editar enquete" : "Nova enquete"}</h2>
        <button
          className="icon-button"
          aria-label="Fechar edição"
          onClick={cancel}
        >
          <X size={20} />
        </button>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <Field label="Pergunta">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            minLength={5}
            maxLength={180}
          />
        </Field>
        <Field label="Opções (uma por linha, de 2 a 6)">
          <textarea
            value={choices}
            onChange={(e) => setChoices(e.target.value)}
            required
            rows={6}
            disabled={!!poll?.total}
          />
        </Field>
        {!!poll?.total && (
          <p className="admin-table-note">
            As opções ficam preservadas após o primeiro voto. Crie outra enquete
            para alterar as alternativas.
          </p>
        )}
        <div className="admin-form-row">
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Rascunho</option>
              <option value="active">Ativa no site</option>
              <option value="closed">Encerrada</option>
            </select>
          </Field>
          <Field label="Encerramento (opcional, horário local)">
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        <p className="admin-message error" role="alert">
          {error}
        </p>
        <div className="admin-form-actions">
          <button className="yellow-button" disabled={busy}>
            {busy ? "Salvando…" : "Salvar enquete"}
            <Check size={16} />
          </button>
          <button
            type="button"
            className="outline-button"
            onClick={cancel}
            disabled={busy}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

function SettingsEditor({
  settings,
  radio,
  saved,
}: {
  settings: RadioSettings;
  radio: boolean;
  saved: () => void;
}) {
  const [values, setValues] = useState(settings),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => setValues(settings), [settings]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = Object.fromEntries(
      (radio
        ? ["stream_url"]
        : ["instagram_url", "youtube_url", "contact_email"]
      ).map((key) => [key, values[key as keyof RadioSettings]?.trim() || null]),
    );
    const response = await client
      .from("radio_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("id")
      .single();
    setBusy(false);
    if (response.error) setMessage("Não foi possível salvar. Tente novamente.");
    else {
      setMessage("Configuração salva.");
      saved();
    }
  }
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>
          {radio ? (
            <>
              <Headphones size={19} /> Transmissão da rádio
            </>
          ) : (
            <>
              <Settings size={19} /> Contato e redes sociais
            </>
          )}
        </h2>
      </div>
      <form className="admin-form" onSubmit={submit}>
        {radio ? (
          <>
            <p>
              Insira o endereço direto do áudio da transmissão. O player aparece
              fixo no topo do site.
            </p>
            <Field label="URL do streaming (HTTPS)">
              <input
                type="url"
                pattern="https://.*"
                placeholder="https://seu-servidor.com/stream"
                value={values.stream_url || ""}
                onChange={(e) =>
                  setValues({ ...values, stream_url: e.target.value })
                }
              />
            </Field>
            <p className="admin-table-note">
              Deixe vazio enquanto a transmissão estiver em preparação. Use um
              link de áudio do servidor da rádio.
            </p>
          </>
        ) : (
          <>
            {(
              [
                {
                  key: "contact_email",
                  label: "E-mail de contato",
                  type: "email",
                },
                {
                  key: "instagram_url",
                  label: "Instagram (HTTPS)",
                  type: "url",
                },
                { key: "youtube_url", label: "YouTube (HTTPS)", type: "url" },
              ] as const
            ).map((field) => (
              <Field label={field.label} key={field.key}>
                <input
                  type={field.type}
                  pattern={field.type === "url" ? "https://.*" : undefined}
                  value={values[field.key] || ""}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: e.target.value })
                  }
                />
              </Field>
            ))}
          </>
        )}
        <button className="yellow-button" disabled={busy}>
          {busy ? "Salvando…" : "Salvar configurações"}
          <Check size={16} />
        </button>
        <p className="admin-message" role="status">
          {message}
        </p>
      </form>
    </section>
  );
}
function PasswordForm() {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setMessage("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    const response = await client.auth.updateUser({ password });
    setBusy(false);
    if (response.error)
      setMessage(
        "Não foi possível alterar a senha. Verifique os requisitos e tente novamente.",
      );
    else {
      setPassword("");
      setConfirm("");
      setMessage("Senha atualizada.");
    }
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-row">
        <Field label="Nova senha">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            required
          />
        </Field>
        <Field label="Confirmar nova senha">
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={12}
            required
          />
        </Field>
      </div>
      <button className="outline-button" disabled={busy}>
        {busy ? "Atualizando…" : "Alterar senha"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
