import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Headphones, X } from "lucide-react";

const visitKey = "jk-app-download-popup-v1";

export default function AppDownloadPopup() {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const previousOverflow = useRef<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  function restorePage() {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
    if (previousFocus.current?.isConnected)
      previousFocus.current.focus({ preventScroll: true });
    previousFocus.current = null;
  }

  function close() {
    dialog.current?.close();
    setOpened(false);
    restorePage();
  }

  useEffect(() => {
    try {
      if (sessionStorage.getItem(visitKey)) return;
    } catch { /* The invitation still works when browser storage is unavailable. */ }

    let timer: ReturnType<typeof setTimeout>;
    function show() {
      if (document.hidden || document.querySelector("dialog[open]")) {
        timer = setTimeout(show, 300);
        return;
      }
      if (!dialog.current) return;
      previousFocus.current = document.activeElement instanceof HTMLElement
        ? document.activeElement : null;
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      setOpened(true);
      dialog.current.showModal();
      closeButton.current?.focus({ preventScroll: true });
      try { sessionStorage.setItem(visitKey, "seen"); } catch { /* Session only. */ }
    }
    timer = setTimeout(show, 1200);
    return () => {
      clearTimeout(timer);
      dialog.current?.close();
      restorePage();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="app-download-popup"
      aria-labelledby="app-download-title"
      aria-describedby="app-download-description"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="app-download-card">
        <button
          ref={closeButton}
          className="app-download-close"
          aria-label="Fechar divulgação do aplicativo"
          onClick={close}
        ><X size={22} /></button>
        {opened && !imageFailed && (
          <img
            className="app-download-art"
            src="/images/app-download-popup.webp"
            alt="Leve o rap com você: aplicativo JK HipHop com player em vinil preto e dourado."
            width="1536"
            height="1024"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="app-download-copy">
          <span className="app-download-eyebrow"><Headphones size={15} /> SUA RÁDIO. NO SEU RITMO.</span>
          <h2 id="app-download-title">Leve a JK HipHop com você</h2>
          <p id="app-download-description">Dê o play e siga na sua batida. Ouça em segundo plano e participe da enquete no app da rádio.</p>
          <a className="app-download-cta" href="/downloads/jk-hiphop.apk" onClick={close}>
            <ArrowDownToLine size={20} /> Baixar app para Android
          </a>
          <span className="app-download-requirements">Android 8.0 ou superior · Download do APK · Requer internet</span>
          <button className="app-download-later" onClick={close}>Agora não</button>
        </div>
      </div>
    </dialog>
  );
}
