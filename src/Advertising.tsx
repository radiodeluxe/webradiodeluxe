import { useEffect, useState, type ReactNode } from "react";
import { safeUrl, supabase } from "./lib";

export type Banner = {
  id: "app" | "top" | "main";
  title: string;
  alt_text: string;
  image_url: string | null;
  target_url: string | null;
  enabled: boolean;
  updated_at: string;
};
export const bannerSlots = {
  app: { label: "Aplicativo / topo", size: "728 × 90" },
  top: { label: "Publicidade superior", size: "728 × 90" },
  main: { label: "Publicidade principal", size: "1000 × 140" },
};

export function useAdBanners() {
  const [banners, setBanners] = useState<Banner[] | null>(null);
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) return;
      const response = await supabase.from("ad_banners").select("*");
      if (mounted && !response.error) setBanners(response.data || []);
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  return banners;
}

export function BannerSlot({
  slot,
  banners,
  children,
}: {
  slot: Banner["id"];
  banners: Banner[] | null;
  children: ReactNode;
}) {
  const banner = banners?.find((b) => b.id === slot);
  const image = safeUrl(banner?.image_url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  if (banners && (!banner || !banner.enabled)) return null;
  if (!image || failed) return children;
  const target = safeUrl(banner?.target_url);
  const content = (
    <>
      <img
        src={image}
        alt={banner?.alt_text || banner?.title || "Publicidade Deluxe"}
        loading="lazy"
        onError={() => setFailed(true)}
      />
      <span className="banner-label">PUBLICIDADE</span>
    </>
  );
  return (
    <section
      className={`managed-banner managed-banner-${slot}`}
      aria-label={banner?.title}
    >
      {target ? (
        <a href={target} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      ) : (
        <div>{content}</div>
      )}
    </section>
  );
}
