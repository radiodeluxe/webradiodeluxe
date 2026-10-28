import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Check,
  ExternalLink,
  Image,
  Pencil,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { safeUrl } from "./lib";

type AppSettings = {
  radio_name: string;
  tagline: string;
  logo_url: string | null;
  background_url: string | null;
  show_poll: boolean;
  show_contact: boolean;
};
type AppBanner = {
  id: string;
  title: string;
  alt_text: string;
  image_url: string | null;
  target_url: string | null;
  slot: "top" | "bottom";
  position: number;
  enabled: boolean;
};
const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
function imageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\/images\/[a-z0-9][a-z0-9_-]*\.webp$/.test(value)) return value;
  return /\s/.test(value) ? null : safeUrl(value);
}
function linkUrl(value: string): string | null {
  return /\s/.test(value) ? null : safeUrl(value);
}
async function uploadImage(
  client: SupabaseClient,
  file: File,
  folder: "branding" | "banner",
) {
  if (!Object.hasOwn(imageTypes, file.type) || !file.size || file.size > 5242880)
    throw Error("invalid image");
  const path = `${folder}/${crypto.randomUUID()}.${imageTypes[file.type]}`;
  const response = await client.storage.from("deluxe-app").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (response.error) throw response.error;
  return {
    path,
    url: client.storage.from("deluxe-app").getPublicUrl(path).data.publicUrl,
  };
}
async function cleanUploads(client: SupabaseClient, paths: string[]) {
  if (paths.length) {
    try {
      await client.storage.from("deluxe-app").remove(paths);
    } catch {
      // Preserve the editor and original save error if cleanup is unavailable.
    }
  }
}

function ImageField({
  label,
  value,
  file,
  disabled,
  changed,
  fileChanged,
  invalid,
  banner = false,
}: {
  label: string;
  value: string;
  file: File | null;
  disabled: boolean;
  changed: (value: string) => void;
  fileChanged: (file: File | null) => void;
  invalid: (message: string) => void;
  banner?: boolean;
}) {
  const [preview, setPreview] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => setDimensions(null), [file, value]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      setInputKey((value) => value + 1);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="admin-app-image-field">
      <label className="admin-field">
        <span>
          <Upload size={15} /> Enviar {label.toLocaleLowerCase("pt-BR")} (até 5
          MB)
        </span>
        <input
          key={inputKey}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.files?.[0] || null;
            if (
              next &&
              (!Object.hasOwn(imageTypes, next.type) || !next.size || next.size > 5242880)
            ) {
              invalid("Use JPG, PNG, WebP ou GIF de até 5 MB.");
              setInputKey((value) => value + 1);
              fileChanged(null);
              return;
            }
            invalid("");
            fileChanged(next);
          }}
        />
      </label>
      <label className="admin-field">
        <span>
          URL da {label.toLocaleLowerCase("pt-BR")} (HTTPS ou
          /images/arquivo.webp)
        </span>
        <input
          value={value}
          onChange={(event) => changed(event.target.value)}
          maxLength={4096}
          disabled={disabled || !!file}
          placeholder="https://…"
        />
      </label>
      {(preview || imageUrl(value)) && (
        <div
          className={`admin-app-image-preview ${banner ? "admin-app-banner-preview" : ""}`}
        >
          <img
            src={preview || imageUrl(value)!}
            alt={`Prévia: ${label}`}
            onLoad={(event) =>
              setDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
        </div>
      )}
      {banner && (
        <p className="admin-app-image-guidance">
          <strong>
            Banner do app: proporção 1:1. Recomendado: 1080 × 1080 px.
          </strong>{" "}
          Para alta resolução, use 2160 × 2160 px. Exemplo no celular: 360 × 360
          px. JPG, PNG, WebP ou GIF de até 5 MB.
          {dimensions && (
            <span>
              Imagem enviada: {dimensions.width} × {dimensions.height} px.
              {Math.abs(dimensions.width / dimensions.height - 1) > 0.08 &&
                " A proporção é diferente de 1:1; a imagem será ajustada sem cortes nem deformação e poderá deixar faixas nas bordas."}
            </span>
          )}
        </p>
      )}
      {(value || file) && (
        <button
          type="button"
          className="text-action"
          disabled={disabled}
          onClick={() => {
            changed("");
            fileChanged(null);
          }}
        >
          <X size={14} /> Remover {label.toLocaleLowerCase("pt-BR")}
        </button>
      )}
    </div>
  );
}

export default function AppManager({
  client,
  saved,
}: {
  client: SupabaseClient;
  saved: () => void;
}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [banners, setBanners] = useState<AppBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AppBanner | null | undefined>(
    undefined,
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reloadBanners = useCallback(async () => {
    const response = await client
      .from("app_banners")
      .select("*")
      .order("position")
      .order("created_at")
      .order("id");
    if (response.error) throw response.error;
    setBanners((response.data || []) as AppBanner[]);
  }, [client]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [response] = await Promise.all([
        client
          .from("app_settings")
          .select(
            "radio_name,tagline,logo_url,background_url,show_poll,show_contact",
          )
          .eq("id", 1)
          .single(),
        reloadBanners(),
      ]);
      if (response.error || !response.data)
        throw response.error || Error("missing configuration");
      setSettings(response.data as AppSettings);
    } catch {
      setError("Não foi possível carregar o aplicativo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [client, reloadBanners]);
  useEffect(() => {
    void load();
  }, [load]);
  async function change(banner: AppBanner, remove = false) {
    if (busy) return;
    if (!remove && !banner.enabled && !imageUrl(banner.image_url)) {
      setError("Adicione uma imagem ao anúncio antes de ativá-lo.");
      return;
    }
    setBusy(banner.id);
    setError("");
    try {
      const query = remove
        ? client.from("app_banners").delete()
        : client.from("app_banners").update({ enabled: !banner.enabled });
      const response = await query.eq("id", banner.id).select("id").single();
      if (response.error) throw response.error;
      setDeleting(null);
      await reloadBanners();
      saved();
    } catch {
      setError(
        remove
          ? "Não foi possível excluir este anúncio. Tente novamente."
          : "Não foi possível alterar este anúncio. Tente novamente.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="admin-app-management">
      <section className="admin-card admin-app-intro">
        <div className="admin-card-heading">
          <h2>
            <Smartphone size={19} /> Aplicativo Android JK HipHop
          </h2>
          <a
            href="/aplicativo"
            target="_blank"
            rel="noopener noreferrer"
            className="outline-button"
          >
            Ver aplicativo <ExternalLink size={15} />
          </a>
        </div>
        <p>
          Identidade visual, publicidade quadrada no topo e player na parte inferior. Os
          anúncios ativos no topo se alternam a cada{" "}
          <strong>15 segundos</strong>.
        </p>
        <p className="admin-table-note">
          Os ouvintes usam o app sem login. As configurações publicadas são
          recebidas pelo aplicativo quando houver conexão.
        </p>
        {loading && <p role="status">Carregando configuração do aplicativo…</p>}
        {error && (
          <p role="alert" className="admin-message error">
            {error}
          </p>
        )}
        {!loading && !settings && (
          <button
            type="button"
            className="outline-button"
            onClick={() => void load()}
          >
            <RefreshCw size={15} /> Tentar novamente
          </button>
        )}
      </section>
      {settings && (
        <AppSettingsEditor client={client} initial={settings} saved={saved} />
      )}
      {!loading &&
        settings &&
        (editing !== undefined ? (
          <AppBannerEditor
            key={editing?.id || "new-app-banner"}
            client={client}
            item={editing}
            nextPosition={Math.min(
              9999,
              banners.reduce((max, item) => Math.max(max, item.position), -1) +
                1,
            )}
            cancel={() => setEditing(undefined)}
            saved={async () => {
              setEditing(undefined);
              try {
                await reloadBanners();
              } catch {
                setError(
                  "Anúncio salvo. Não foi possível atualizar a lista; abra o módulo novamente.",
                );
              }
              saved();
            }}
          />
        ) : (
          <section className="admin-card">
            <div className="admin-card-heading">
              <h2>
                <Image size={19} /> Publicidade do aplicativo
              </h2>
              <button
                type="button"
                className="yellow-button"
                disabled={!!busy}
                onClick={() => setEditing(null)}
              >
                <Plus size={16} /> Novo anúncio do app
              </button>
            </div>
            <p className="admin-table-note">
              Cadastre anúncios quadrados no topo do app. A menor posição
              aparece primeiro; a troca ocorre a cada 15 segundos.
            </p>
            <div className="admin-app-banner-spec">
              <strong>Topo do app: banners quadrados na proporção 1:1</strong>
              <span>
                Recomendado: 1080 × 1080 px · Alta resolução: 2160 × 2160 px
              </span>
              <span>
                Exibição de exemplo no celular: 360 × 360 px · JPG, PNG, WebP ou
                GIF · Até 5 MB
              </span>
              <small>
                Prévia em escala 1:1. As imagens são exibidas inteiras, sem
                cortes nem deformação.
              </small>
            </div>
            {!banners.length && (
              <p className="admin-empty">
                Nenhum anúncio do aplicativo cadastrado.
              </p>
            )}
            <div className="admin-app-banner-grid">
              {banners.map((banner) => (
                <article key={banner.id} className="admin-banner-item">
                  <div className="admin-banner-preview admin-app-banner-preview">
                    {imageUrl(banner.image_url) ? (
                      <img
                        src={imageUrl(banner.image_url)!}
                        alt={banner.alt_text || banner.title}
                      />
                    ) : (
                      <div>
                        <Image size={24} /> Sem imagem
                      </div>
                    )}
                  </div>
                  <div className="admin-content-item-heading">
                    <span
                      className={`admin-badge ${banner.enabled ? "active" : "draft"}`}
                    >
                      {banner.enabled ? "Ativo" : "Desativado"}
                    </span>
                    <small>
                      Topo · Posição{" "}
                      {banner.position}
                    </small>
                  </div>
                  <h3>{banner.title}</h3>
                  <div className="admin-banner-actions">
                    <button
                      type="button"
                      className="outline-button"
                      disabled={!!busy}
                      onClick={() => setEditing(banner)}
                      aria-label={`Editar anúncio ${banner.title}`}
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      className="text-action"
                      disabled={!!busy}
                      onClick={() => void change(banner)}
                      aria-label={`${banner.enabled ? "Desativar" : "Ativar"} anúncio ${banner.title}`}
                    >
                      {banner.enabled ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      className="text-action admin-delete-button"
                      disabled={!!busy}
                      onClick={() => setDeleting(banner.id)}
                      aria-label={`Excluir anúncio ${banner.title}`}
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                  {deleting === banner.id && (
                    <div className="admin-content-confirm">
                      <p>
                        Excluir o anúncio “{banner.title}”? Ele deixará de
                        aparecer no aplicativo.
                      </p>
                      <div className="admin-form-actions">
                        <button
                          type="button"
                          className="yellow-button"
                          disabled={!!busy}
                          onClick={() => void change(banner, true)}
                        >
                          Confirmar exclusão do anúncio
                        </button>
                        <button
                          type="button"
                          className="outline-button"
                          disabled={!!busy}
                          onClick={() => setDeleting(null)}
                        >
                          Cancelar exclusão
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function AppSettingsEditor({
  client,
  initial,
  saved,
}: {
  client: SupabaseClient;
  initial: AppSettings;
  saved: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    if (
      values.radio_name.trim().length < 3 ||
      values.radio_name.trim().length > 80
    ) {
      setError("Informe o nome da rádio com 3 a 80 caracteres.");
      return;
    }
    if (
      (!logoFile &&
        values.logo_url?.trim() &&
        !imageUrl(values.logo_url.trim())) ||
      (!backgroundFile &&
        values.background_url?.trim() &&
        !imageUrl(values.background_url.trim()))
    ) {
      setError("Use imagens HTTPS válidas ou /images/arquivo.webp.");
      return;
    }
    setBusy(true);
    const uploaded: string[] = [];
    try {
      const data: AppSettings = {
        ...values,
        radio_name: values.radio_name.trim(),
        tagline: values.tagline.trim(),
        logo_url: imageUrl(values.logo_url?.trim()),
        background_url: imageUrl(values.background_url?.trim()),
      };
      if (logoFile) {
        const image = await uploadImage(client, logoFile, "branding");
        uploaded.push(image.path);
        data.logo_url = image.url;
      }
      if (backgroundFile) {
        const image = await uploadImage(client, backgroundFile, "branding");
        uploaded.push(image.path);
        data.background_url = image.url;
      }
      const response = await client
        .from("app_settings")
        .update(data)
        .eq("id", 1)
        .select("id")
        .single();
      if (response.error) throw response.error;
      setValues(data);
      setLogoFile(null);
      setBackgroundFile(null);
      setNotice("Identidade do aplicativo salva.");
      saved();
    } catch {
      await cleanUploads(client, uploaded);
      setError(
        "Não foi possível salvar o aplicativo. Confira os campos e as imagens e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>
          <Smartphone size={19} /> Identidade e menu do aplicativo
        </h2>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Nome da rádio no app</span>
            <input
              value={values.radio_name}
              onChange={(event) =>
                setValues({ ...values, radio_name: event.target.value })
              }
              minLength={3}
              maxLength={80}
              required
              disabled={busy}
            />
          </label>
          <label className="admin-field">
            <span>Slogan do aplicativo</span>
            <input
              value={values.tagline}
              onChange={(event) =>
                setValues({ ...values, tagline: event.target.value })
              }
              maxLength={160}
              disabled={busy}
            />
          </label>
        </div>
        <div className="admin-app-assets">
          <ImageField
            label="Logo"
            value={values.logo_url || ""}
            file={logoFile}
            disabled={busy}
            changed={(logo_url) => setValues({ ...values, logo_url })}
            fileChanged={setLogoFile}
            invalid={setError}
          />
          <ImageField
            label="Imagem de fundo"
            value={values.background_url || ""}
            file={backgroundFile}
            disabled={busy}
            changed={(background_url) =>
              setValues({ ...values, background_url })
            }
            fileChanged={setBackgroundFile}
            invalid={setError}
          />
        </div>
        <p className="admin-table-note">
          Deixe a logo ou o fundo vazios para usar o visual padrão JK HipHop do
          aplicativo. A imagem de fundo recebe uma camada escura para preservar
          a leitura.
        </p>
        <div className="admin-app-toggles">
          <label className="admin-banner-enabled">
            <input
              type="checkbox"
              checked={values.show_poll}
              onChange={(event) =>
                setValues({ ...values, show_poll: event.target.checked })
              }
              disabled={busy}
            />{" "}
            Mostrar enquete no menu
          </label>
          <label className="admin-banner-enabled">
            <input
              type="checkbox"
              checked={values.show_contact}
              onChange={(event) =>
                setValues({ ...values, show_contact: event.target.checked })
              }
              disabled={busy}
            />{" "}
            Mostrar contato no menu
          </label>
        </div>
        <p className="admin-table-note">
          Rotação da publicidade: 15 segundos por anúncio, no carrossel superior.
        </p>
        <button className="yellow-button" disabled={busy}>
          {busy ? "Salvando…" : "Salvar aplicativo"}
          <Check size={16} />
        </button>
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
      </form>
    </section>
  );
}

function AppBannerEditor({
  client,
  item,
  nextPosition,
  cancel,
  saved,
}: {
  client: SupabaseClient;
  item: AppBanner | null;
  nextPosition: number;
  cancel: () => void;
  saved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [alt, setAlt] = useState(item?.alt_text || "");
  const [image, setImage] = useState(item?.image_url || "");
  const [link, setLink] = useState(item?.target_url || "");
  // Keep existing placements compatible with installations of app 1.0.
  const slot = item?.slot || "top";
  const [position, setPosition] = useState(item?.position ?? nextPosition);
  const [enabled, setEnabled] = useState(item?.enabled ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (title.trim().length < 3 || title.trim().length > 120) {
      setError("Informe um título com 3 a 120 caracteres.");
      return;
    }
    if (
      (!file && image.trim() && !imageUrl(image.trim())) ||
      (link.trim() && !linkUrl(link.trim()))
    ) {
      setError(
        "Use links HTTPS válidos. Imagens locais devem usar /images/arquivo.webp.",
      );
      return;
    }
    if (enabled && !file && !image.trim()) {
      setError("Adicione uma imagem antes de ativar o anúncio.");
      return;
    }
    if (!Number.isInteger(position) || position < 0 || position > 9999) {
      setError("A posição deve ser um inteiro entre 0 e 9999.");
      return;
    }
    setBusy(true);
    const uploaded: string[] = [];
    try {
      let persistedImage = imageUrl(image.trim());
      if (file) {
        const upload = await uploadImage(client, file, "banner");
        uploaded.push(upload.path);
        persistedImage = upload.url;
      }
      const data = {
        title: title.trim(),
        alt_text: alt.trim(),
        image_url: persistedImage,
        target_url: linkUrl(link.trim()),
        slot,
        position,
        enabled,
      };
      const response = item
        ? await client
            .from("app_banners")
            .update(data)
            .eq("id", item.id)
            .select("id")
            .single()
        : await client.from("app_banners").insert(data).select("id").single();
      if (response.error) throw response.error;
      await saved();
    } catch {
      await cleanUploads(client, uploaded);
      setError(
        "Não foi possível salvar o anúncio. Confira os campos e a imagem e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>
          {item
            ? "Editar anúncio do aplicativo"
            : "Cadastrar anúncio do aplicativo"}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar edição do anúncio"
          onClick={cancel}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <label className="admin-field">
          <span>Título do anúncio do app</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            minLength={3}
            maxLength={120}
            required
            disabled={busy}
          />
        </label>
        <label className="admin-field">
          <span>Descrição acessível da publicidade</span>
          <input
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            maxLength={240}
            disabled={busy}
            placeholder="Descreva a mensagem e a marca do anúncio."
          />
        </label>
        <ImageField
          label="Imagem do anúncio"
          value={image}
          file={file}
          disabled={busy}
          changed={setImage}
          fileChanged={setFile}
          invalid={setError}
          banner
        />
        <label className="admin-field">
          <span>Link do anúncio (HTTPS, opcional)</span>
          <input
            type="url"
            pattern="https://.*"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            maxLength={4096}
            disabled={busy}
          />
        </label>
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Ordem de rotação (menor primeiro)</span>
            <input
              type="number"
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
              min={0}
              max={9999}
              step={1}
              required
              disabled={busy}
            />
          </label>
        </div>
        <label className="admin-banner-enabled">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={busy}
          />{" "}
          Anúncio ativo no aplicativo
        </label>
        <p className="admin-table-note">
          Os anúncios ativos no topo se alternam a cada 15 segundos. Salve
          desativado para preparar um rascunho.
        </p>
        <div className="admin-form-actions">
          <button className="yellow-button" disabled={busy}>
            {busy ? "Salvando…" : "Salvar anúncio do app"}
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
        {error && (
          <p role="alert" className="admin-message error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
