import { useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import "./app-ticker.css";

export default function AppTicker({ text, color = "black" }: { text: string; color?: "black" | "white" }) {
  const [paused, setPaused] = useState(false);
  const message = text.trim();
  if (!message) return null;
  return (
    <section className={`app-ticker${paused ? " is-paused" : ""}`} aria-label="Mensagem da rádio"
      style={{ color: color === "white" ? "#ffffff" : "#000000", "--ticker-duration": `${Math.max(12, message.length * 0.18)}s` } as CSSProperties}>
      <div className="app-ticker-viewport">
        <div className="app-ticker-track">
          <span>{message}</span><span aria-hidden="true">{message}</span>
        </div>
      </div>
      <button type="button" onClick={() => setPaused(!paused)}
        aria-label={paused ? "Continuar texto deslizante" : "Pausar texto deslizante"}>
        {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
      </button>
    </section>
  );
}
