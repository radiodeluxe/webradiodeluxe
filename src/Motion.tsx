import { useEffect, type RefObject } from "react";
import { Crown } from "lucide-react";

export function LoadingState({
  label = "Carregando…",
  fullscreen = false,
}: {
  label?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      className={`deluxe-loader ${fullscreen ? "loader-screen" : ""}`}
      role="status"
    >
      {fullscreen && <Crown className="loader-crown" aria-hidden="true" />}
      <div className="loader-wave" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <span>{label}</span>
    </div>
  );
}

// Observe section entrances once; leave content usable without observer support.
export function useScrollReveal(
  rootRef: RefObject<HTMLElement | null>,
  pageKey = "site",
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -32px 0px" },
    );
    function reveal(target: HTMLElement) {
      target.classList.remove("reveal-pending");
      target.classList.add("reveal-visible");
      observer.unobserve(target);
    }
    function register() {
      root!
        .querySelectorAll<HTMLElement>(
          "section:not(.hero), .admin-welcome, .admin-metrics, .admin-card",
        )
        .forEach((target) => {
          if (targets.has(target)) return;
          targets.add(target);
          target.classList.add("scroll-reveal");
          if (
            media.matches ||
            target.getBoundingClientRect().top < window.innerHeight - 32
          ) {
            reveal(target);
          } else {
            target.classList.add("reveal-pending");
            observer.observe(target);
          }
        });
    }
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        const target = event.target.closest<HTMLElement>(".reveal-pending");
        if (target) reveal(target);
      }
    };
    const onPreference = () => {
      if (media.matches) targets.forEach(reveal);
    };
    register();
    const mutations = new MutationObserver(register);
    mutations.observe(root, { childList: true, subtree: true });
    root.addEventListener("focusin", onFocus);
    media.addEventListener("change", onPreference);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      root.removeEventListener("focusin", onFocus);
      media.removeEventListener("change", onPreference);
      targets.forEach((target) =>
        target.classList.remove(
          "scroll-reveal",
          "reveal-pending",
          "reveal-visible",
        ),
      );
    };
  }, [rootRef, pageKey]);
}
