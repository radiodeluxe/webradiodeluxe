import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Check,
  Image,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { safeUrl } from "./lib";

export type ContentKind = "program" | "playlist" | "team" | "gallery";
export type ContentItem = {
  id: string;
  kind: ContentKind;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  time_label: string;
  days_label: string;
  position: number;
  enabled: boolean;
  updated_at: string;
};

const labels = {
  program: {
    plural: "Programas",
    singular: "programa",
    title: "Nome do programa",
    description: "Descrição do programa",
  },
  playlist: {
    plural: "Playlists",
    singular: "playlist",
    title: "Nome da playlist",
    description: "Descrição da playlist",
  },
  team: {
    plural: "Equipe",
    singular: "integrante",
    title: "Nome do integrante",
    description: "Biografia / apresentação",
  },
  gallery: {
    plural: "Galeria",
    singular: "imagem",
    title: "Título / legenda da imagem",
    description: "Contexto e descrição da imagem",
  },
} as const;

function imageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\/images\/[a-z0-9][a-z0-9_-]*\.webp$/.test(value)) return value;
  return safeUrl(value);
}

export default function ContentManager({
  client,
  kind,
  saved,
}: {
  client: SupabaseClient;
  kind: ContentKind;
  saved: () => void;
}) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentItem | null | undefined>(
    undefined,
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const names = labels[kind];
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await client
        .from("site_content")
        .select("*")
        .eq("kind", kind)
        .order("position")
        .order("created_at")
        .order("id");
      if (response.error) throw response.error;
      setItems((response.data || []) as ContentItem[]);
    } catch {
      setError(
        `Não foi possível carregar ${names.plural.toLocaleLowerCase("pt-BR")}. Tente atualizar a lista.`,
      );
    } finally {
      setLoading(false);
    }
  }, [client, kind, names.plural]);
  useEffect(() => {
    void reload();
  }, [reload]);

  async function change(item: ContentItem, remove = false) {
    if (busy) return;
    if (
      !remove &&
      !item.enabled &&
      kind === "gallery" &&
      !imageUrl(item.image_url)
    ) {
      setError("Inclua uma imagem antes de ativar este item da galeria.");
      return;
    }
    setBusy(item.id);
    setError("");
    try {
      const query = remove
        ? client.from("site_content").delete()
        : client.from("site_content").update({ enabled: !item.enabled });
      const response = await query
        .eq("id", item.id)
        .eq("kind", kind)
        .select("id")
        .single();
      if (response.error) throw response.error;
      setDeleting(null);
      await reload();
      saved();
    } catch {
      setError(
        remove
          ? "Não foi possível excluir este item. Tente novamente."
          : "Não foi possível alterar a publicação. Tente novamente.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (editing !== undefined)
    return (
      <ContentEditor
        key={editing?.id || `new-${kind}`}
        client={client}
        kind={kind}
        item={editing}
        nextPosition={Math.min(
          9999,
          items.reduce(
            (maximum, item) => Math.max(maximum, item.position),
            -1,
          ) + 1,
        )}
        cancel={() => setEditing(undefined)}
        saved={() => {
          setEditing(undefined);
          void reload();
          saved();
        }}
      />
    );

  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>
          <Image size={19} /> {names.plural}
        </h2>
        <button
          className="yellow-button"
          onClick={() => setEditing(null)}
          disabled={loading || !!busy}
        >
          <Plus size={16} />{" "}
          {kind === "gallery"
            ? "Nova imagem"
            : kind === "team"
              ? "Novo integrante"
              : kind === "playlist"
                ? "Nova playlist"
                : "Novo programa"}
        </button>
      </div>
      <p className="admin-table-note">
        Edite o conteúdo, a imagem e a ordem de exibição. Apenas itens ativos
        aparecem no site. A menor posição aparece primeiro.{" "}
        {kind === "team" &&
          "Cadastre somente integrantes reais e imagens autorizadas."}
        {kind === "gallery" &&
          "Identifique na descrição imagens ilustrativas e créditos quando necessário."}
      </p>
      <button
        className="text-action admin-content-refresh"
        onClick={() => void reload()}
        disabled={loading || !!busy}
      >
        <RefreshCw size={14} className={loading ? "spin" : ""} /> Atualizar
        lista
      </button>
      {error && (
        <p className="admin-message error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="admin-empty" role="status">
          Carregando {names.plural.toLocaleLowerCase("pt-BR")}…
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="admin-empty">
          Nenhum item cadastrado. Use o botão acima para começar.
        </p>
      )}
      <div className="admin-content-grid">
        {items.map((item) => (
          <article className="admin-content-item" key={item.id}>
            <div className="admin-content-preview">
              {imageUrl(item.image_url) ? (
                <img
                  src={imageUrl(item.image_url)!}
                  alt={item.title}
                  loading="lazy"
                />
              ) : (
                <span>
                  <Image size={28} /> Sem imagem
                </span>
              )}
            </div>
            <div className="admin-content-item-heading">
              <span
                className={`admin-badge ${item.enabled ? "active" : "draft"}`}
              >
                {item.enabled ? "Ativo" : "Desativado"}
              </span>
              <small>Posição {item.position}</small>
            </div>
            <h3>{item.title}</h3>
            {item.time_label && (
              <p className="admin-content-meta">
                {item.time_label}
                {item.days_label ? ` · ${item.days_label}` : ""}
              </p>
            )}
            {item.description && (
              <p className="admin-content-description">{item.description}</p>
            )}
            <div className="admin-banner-actions">
              <button
                className="outline-button"
                disabled={!!busy}
                onClick={() => setEditing(item)}
                aria-label={`Editar ${item.title}`}
              >
                <Pencil size={14} /> Editar
              </button>
              <button
                className="text-action"
                disabled={!!busy}
                onClick={() => void change(item)}
                aria-label={`${item.enabled ? "Desativar" : "Ativar"} ${item.title}`}
              >
                {busy === item.id
                  ? "Salvando…"
                  : item.enabled
                    ? "Desativar"
                    : "Ativar"}
              </button>
              <button
                className="icon-button admin-delete-button"
                disabled={!!busy}
                onClick={() => setDeleting(item.id)}
                aria-label={`Excluir ${item.title}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
            {deleting === item.id && (
              <div className="admin-content-confirm" role="alert">
                <p>
                  Excluir “{item.title}” permanentemente? O item também será
                  removido do site.
                </p>
                <div className="admin-form-actions">
                  <button
                    className="outline-button"
                    disabled={!!busy}
                    onClick={() => void change(item, true)}
                  >
                    {busy === item.id ? "Excluindo…" : "Confirmar exclusão"}
                  </button>
                  <button
                    className="text-action"
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
  );
}

function ContentEditor({
  client,
  kind,
  item,
  nextPosition,
  cancel,
  saved,
}: {
  client: SupabaseClient;
  kind: ContentKind;
  item: ContentItem | null;
  nextPosition: number;
  cancel: () => void;
  saved: () => void;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [image, setImage] = useState(item?.image_url || "");
  const [link, setLink] = useState(item?.link_url || "");
  const [time, setTime] = useState(item?.time_label || "");
  const [days, setDays] = useState(item?.days_label || "");
  const [position, setPosition] = useState(item?.position ?? nextPosition);
  const [enabled, setEnabled] = useState(item?.enabled ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = labels[kind];
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  function chooseFile(next: File | null) {
    setError("");
    if (
      next &&
      (!Object.hasOwn(imageTypes, next.type) ||
        next.size > 5242880 ||
        next.size === 0)
    ) {
      setError("Use JPG, PNG, WebP ou GIF de até 5 MB.");
      setFile(null);
      setFileKey((key) => key + 1);
      return;
    }
    setFile(next);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim().length < 3) {
      setError("Informe um nome com pelo menos 3 caracteres.");
      return;
    }
    if (
      (!file && image.trim() && !imageUrl(image.trim())) ||
      (link.trim() && !safeUrl(link.trim()))
    ) {
      setError(
        "Use uma URL HTTPS válida. Imagens locais devem estar na pasta /images e usar o formato WebP.",
      );
      return;
    }
    if (kind === "gallery" && enabled && !file && !image.trim()) {
      setError("Adicione uma imagem para publicar na galeria.");
      return;
    }
    if (!Number.isInteger(position) || position < 0 || position > 9999) {
      setError("A posição deve ser um número inteiro entre 0 e 9999.");
      return;
    }
    setBusy(true);
    setError("");
    let uploaded: string | null = null;
    try {
      let persistedImage = imageUrl(image.trim());
      if (file) {
        const extension = imageTypes[file.type];
        if (!extension || file.size === 0 || file.size > 5242880)
          throw Error("invalid image");
        const path = `${kind}/${crypto.randomUUID()}.${extension}`;
        const upload = await client.storage
          .from("deluxe-content")
          .upload(path, file, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          });
        if (upload.error) throw upload.error;
        uploaded = path;
        persistedImage = client.storage
          .from("deluxe-content")
          .getPublicUrl(path).data.publicUrl;
      }
      const values = {
        kind,
        title: title.trim(),
        description: description.trim(),
        image_url: persistedImage,
        link_url: safeUrl(link.trim()),
        time_label: kind === "program" || kind === "team" ? time.trim() : "",
        days_label: kind === "program" ? days.trim() : "",
        position,
        enabled,
      };
      const response = item
        ? await client
            .from("site_content")
            .update(values)
            .eq("id", item.id)
            .eq("kind", kind)
            .select("id")
            .single()
        : await client
            .from("site_content")
            .insert(values)
            .select("id")
            .single();
      if (response.error) throw response.error;
      saved();
    } catch {
      if (uploaded)
        await client.storage.from("deluxe-content").remove([uploaded]);
      setError(
        "Não foi possível salvar. Confira os campos e a imagem e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>
          {item ? "Editar" : "Cadastrar"} {names.singular}
        </h2>
        <button
          className="icon-button"
          aria-label="Fechar edição"
          disabled={busy}
          onClick={cancel}
        >
          <X size={20} />
        </button>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <label className="admin-field">
          <span>{names.title}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={3}
            maxLength={160}
            disabled={busy}
          />
        </label>
        <label className="admin-field">
          <span>{names.description}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={4000}
            disabled={busy}
          />
        </label>
        {(kind === "program" || kind === "team") && (
          <div className="admin-form-row">
            <label className="admin-field">
              <span>
                {kind === "team" ? "Cargo / função" : "Horário de transmissão"}
              </span>
              <input
                value={time}
                onChange={(event) => setTime(event.target.value)}
                maxLength={50}
                disabled={busy}
                placeholder={kind === "team" ? "Apresentador(a)" : "08H — 09H"}
              />
            </label>
            {kind === "program" && (
              <label className="admin-field">
                <span>Dias da semana</span>
                <input
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  maxLength={80}
                  disabled={busy}
                  placeholder="SEG A SEX"
                />
              </label>
            )}
          </div>
        )}
        <label className="admin-field">
          <span>
            <Upload size={15} /> Enviar imagem (até 5 MB)
          </span>
          <input
            key={fileKey}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => chooseFile(event.target.files?.[0] || null)}
            disabled={busy}
          />
        </label>
        <label className="admin-field">
          <span>URL da imagem (HTTPS ou /images/arquivo.webp)</span>
          <input
            value={image}
            onChange={(event) => setImage(event.target.value)}
            maxLength={4096}
            disabled={busy || !!file}
            placeholder="https://…"
          />
        </label>
        {(preview || imageUrl(image)) && (
          <div className="admin-content-preview admin-content-editor-preview">
            <img
              src={preview || imageUrl(image)!}
              alt={title || "Prévia da imagem"}
            />
          </div>
        )}
        {(file || image) && (
          <button
            className="text-action"
            type="button"
            disabled={busy}
            onClick={() => {
              setFile(null);
              setImage("");
              setFileKey((key) => key + 1);
            }}
          >
            Remover imagem
          </button>
        )}
        <label className="admin-field">
          <span>
            {kind === "playlist"
              ? "Link da playlist (HTTPS, opcional)"
              : "Link relacionado (HTTPS, opcional)"}
          </span>
          <input
            type="url"
            pattern="https://.*"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            maxLength={4096}
            disabled={busy}
            placeholder={
              kind === "playlist"
                ? "https://www.youtube.com/playlist?list=…"
                : "https://…"
            }
          />
        </label>
        {kind === "playlist" && (
          <p className="admin-table-note">
            Cadastre o link oficial quando a seleção estiver pronta. Sem link, o
            site informa que a curadoria está em preparação.
          </p>
        )}
        <label className="admin-field">
          <span>Posição na lista (menor aparece primeiro)</span>
          <input
            type="number"
            min={0}
            max={9999}
            step={1}
            required
            value={Number.isNaN(position) ? "" : position}
            onChange={(event) => setPosition(event.target.valueAsNumber)}
            disabled={busy}
          />
        </label>
        <label className="admin-banner-enabled">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={busy}
          />{" "}
          Exibir este item no site
        </label>
        {error && (
          <p className="admin-message error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-form-actions">
          <button className="yellow-button" disabled={busy}>
            <Check size={16} /> {busy ? "Salvando…" : "Salvar alterações"}
          </button>
          <button
            type="button"
            className="outline-button"
            disabled={busy}
            onClick={cancel}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
