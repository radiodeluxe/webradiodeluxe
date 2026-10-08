import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Check, Image, Pencil, Upload, X } from "lucide-react";
import { bannerSlots, type Banner } from "./Advertising";
import { safeUrl } from "./lib";

export default function BannerManager({
  client,
  banners,
  saved,
}: {
  client: SupabaseClient;
  banners: Banner[];
  saved: () => void;
}) {
  const [editing, setEditing] = useState<Banner | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function toggle(banner: Banner) {
    if (busy) return;
    setBusy(banner.id);
    setError("");
    try {
      const result = await client
        .from("ad_banners")
        .update({
          enabled: !banner.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", banner.id)
        .select("id")
        .single();
      if (result.error) throw result.error;
      saved();
    } catch {
      setError("Não foi possível alterar o banner. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }
  if (editing)
    return (
      <BannerEditor
        key={editing.id}
        client={client}
        banner={editing}
        cancel={() => setEditing(null)}
        saved={() => {
          setEditing(null);
          saved();
        }}
      />
    );
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>
          <Image size={19} /> Banners de publicidade
        </h2>
      </div>
      <p className="admin-table-note">
        Configure os três espaços do site. Envie uma imagem ou use uma URL
        HTTPS. Sem imagem, o espaço exibe a chamada original da Deluxe.
        Desativar oculta o espaço.
      </p>
      {error && (
        <p className="admin-message error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-banner-grid">
        {banners.map((banner) => (
          <article className="admin-banner-item" key={banner.id}>
            <div className={`admin-banner-preview preview-${banner.id}`}>
              {safeUrl(banner.image_url) ? (
                <img
                  src={safeUrl(banner.image_url)!}
                  alt={banner.alt_text || banner.title}
                />
              ) : (
                <div>
                  <Image size={30} />
                  <span>Chamada original da Deluxe</span>
                </div>
              )}
            </div>
            <h3>{bannerSlots[banner.id].label}</h3>
            <p>
              {bannerSlots[banner.id].size} px ·{" "}
              {banner.enabled ? "Ativo" : "Desativado"}
            </p>
            <div className="admin-banner-actions">
              <button
                className="outline-button"
                disabled={!!busy}
                onClick={() => setEditing(banner)}
                aria-label={`Editar banner ${bannerSlots[banner.id].label}`}
              >
                <Pencil size={14} /> Editar banner
              </button>
              <button
                className="text-action"
                disabled={!!busy}
                onClick={() => toggle(banner)}
                aria-label={`${banner.enabled ? "Desativar" : "Ativar"} banner ${bannerSlots[banner.id].label}`}
              >
                {busy === banner.id
                  ? "Salvando…"
                  : banner.enabled
                    ? "Desativar"
                    : "Ativar"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BannerEditor({
  client,
  banner,
  cancel,
  saved,
}: {
  client: SupabaseClient;
  banner: Banner;
  cancel: () => void;
  saved: () => void;
}) {
  const [title, setTitle] = useState(banner.title);
  const [alt, setAlt] = useState(banner.alt_text);
  const [image, setImage] = useState(banner.image_url || "");
  const [target, setTarget] = useState(banner.target_url || "");
  const [enabled, setEnabled] = useState(banner.enabled);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileKey, setFileKey] = useState(0);
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
      (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        next.type,
      ) ||
        next.size > 5242880)
    ) {
      setError("Use JPG, PNG, WebP ou GIF de até 5 MB.");
      setFile(null);
      setFileKey((k) => k + 1);
      return;
    }
    setFile(next);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      (!file && image.trim() && !safeUrl(image.trim())) ||
      (target.trim() && !safeUrl(target.trim()))
    ) {
      setError("Use endereços HTTPS válidos para a imagem e o destino.");
      return;
    }
    setBusy(true);
    setError("");
    let uploaded: string | null = null;
    try {
      let imageUrl = image.trim() || null;
      if (file) {
        const ext = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
        }[file.type];
        if (!ext || file.size > 5242880) throw Error("invalid image");
        const path = `${banner.id}/${crypto.randomUUID()}.${ext}`;
        const upload = await client.storage
          .from("deluxe-banners")
          .upload(path, file, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          });
        if (upload.error) throw upload.error;
        uploaded = path;
        imageUrl = client.storage.from("deluxe-banners").getPublicUrl(path)
          .data.publicUrl;
      }
      const result = await client
        .from("ad_banners")
        .update({
          title: title.trim(),
          alt_text: alt.trim() || title.trim(),
          image_url: imageUrl,
          target_url: target.trim() || null,
          enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", banner.id)
        .select("id")
        .single();
      if (result.error) throw result.error;
      saved();
    } catch {
      if (uploaded)
        await client.storage.from("deluxe-banners").remove([uploaded]);
      setError(
        "Não foi possível salvar o banner. Confira a imagem e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>Editar banner · {bannerSlots[banner.id].label}</h2>
        <button
          className="icon-button"
          aria-label="Fechar edição do banner"
          onClick={cancel}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <p>
          Dimensão recomendada:{" "}
          <strong>{bannerSlots[banner.id].size} px</strong>. A imagem se adapta
          ao celular sem cortes.
        </p>
        <label className="admin-field">
          <span>Título do banner</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            maxLength={120}
            disabled={busy}
          />
        </label>
        <label className="admin-field">
          <span>Descrição da imagem (acessibilidade)</span>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={180}
            disabled={busy}
            placeholder="Descreva a oferta ou mensagem do banner"
          />
        </label>
        <label className="admin-field">
          <span>
            <Upload size={15} /> Enviar imagem (até 5 MB)
          </span>
          <input
            key={fileKey}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => chooseFile(e.target.files?.[0] || null)}
            disabled={busy}
          />
        </label>
        <label className="admin-field">
          <span>URL da imagem (HTTPS)</span>
          <input
            type="url"
            pattern="https://.*"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            disabled={busy || !!file}
            placeholder="https://…"
          />
        </label>
        {(preview || safeUrl(image)) && (
          <div className={`admin-banner-preview preview-${banner.id}`}>
            <img src={preview || safeUrl(image)!} alt={alt || title} />
          </div>
        )}
        {(file || image) && (
          <button
            type="button"
            className="text-action"
            disabled={busy}
            onClick={() => {
              setFile(null);
              setImage("");
              setFileKey((k) => k + 1);
            }}
          >
            Remover imagem e restaurar chamada original
          </button>
        )}
        <label className="admin-field">
          <span>Link de destino (HTTPS, opcional)</span>
          <input
            type="url"
            pattern="https://.*"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={busy}
            placeholder="https://…"
          />
        </label>
        <label className="admin-banner-enabled">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={busy}
          />{" "}
          Exibir este espaço no site
        </label>
        {error && (
          <p className="admin-message error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-form-actions">
          <button className="yellow-button" disabled={busy}>
            <Check size={16} />
            {busy ? "Salvando banner…" : "Salvar banner"}
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
