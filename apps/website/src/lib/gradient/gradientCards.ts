// Behaviour of the hero's gradient cards: paint the stills once, and on click grow the card progressively to
// fill the screen; only there does its gradient come alive. Hover (a small lift + scale) is pure CSS on the card.
import type { RuidoEvolutivoConfig } from "@fluxa/gradient-core";
import { loadGsap } from "@/lib/motion/gsap";
import { CARD_PRESETS } from "./cardPresets";
import { mountCardLive, renderCardStills } from "./cardShader";

const byId = new Map(CARD_PRESETS.map((p) => [p.id, p]));

// The central card is the product's real "inferno" shader (ruidoEvolutivo) instead of a fitted recreation; the
// other seven stay as fitted cloth cards. Three.js is only imported when that card needs it.
const INFERNO_CARD = "F";
export function readInfernoConfig(): RuidoEvolutivoConfig | null {
  try {
    const el = document.getElementById("inferno-config");
    return el?.textContent ? (JSON.parse(el.textContent) as RuidoEvolutivoConfig) : null;
  } catch {
    return null;
  }
}
const loadRuido = async () => (await import("@fluxa/ruido-evolutivo-renderer")).mountRuidoEvolutivo;

// One frame of inferno (t = 0 pose) into the card's 2D canvas, through a throwaway offscreen mount: the card
// keeps no WebGL context afterwards. The fitted-shader still painted first stays as the fallback.
async function snapshotInferno(target: HTMLCanvasElement, config: RuidoEvolutivoConfig) {
  const rect = target.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w < 8 || h < 8) return;
  const host = document.createElement("div");
  Object.assign(host.style, { position: "fixed", left: "-99999px", top: "0", width: `${w}px`, height: `${h}px`, pointerEvents: "none" });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  host.append(canvas);
  document.body.append(host);
  try {
    const mount = await loadRuido();
    const handle = mount(canvas, { ...config, animate: "off" }, { preserveDrawingBuffer: true });
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    target.getContext("2d")?.drawImage(canvas, 0, 0, target.width, target.height);
    handle.dispose();
  } catch (error) {
    console.warn("[gradientCards] inferno snapshot failed, keeping the fitted card:", error);
  } finally {
    host.remove();
  }
}
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function paintStills(root: HTMLElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const entries: Parameters<typeof renderCardStills>[0] = [];
  root.querySelectorAll<HTMLButtonElement>("[data-gcard]").forEach((card) => {
    const preset = byId.get(card.dataset.gcard ?? "");
    const canvas = card.querySelector<HTMLCanvasElement>("canvas");
    if (!preset || !canvas) return;
    const rect = card.getBoundingClientRect();
    canvas.width = Math.max(64, Math.round(rect.width * dpr));
    canvas.height = Math.max(36, Math.round(rect.height * dpr));
    entries.push({ canvas, preset });
  });
  renderCardStills(entries);
  const inferno = readInfernoConfig();
  const central = root.querySelector<HTMLCanvasElement>(`[data-gcard="${INFERNO_CARD}"] canvas`);
  if (inferno && central) void snapshotInferno(central, inferno);
}

let opening = false;
/** True while a card is expanded / animating to or from full screen. */
export const isCardOpen = () => opening;

async function expand(card: HTMLElement) {
  const preset = byId.get(card.dataset.gcard ?? "");
  if (!preset || opening) return;
  opening = true;
  const { gsap } = await loadGsap();
  const inferno = preset.id === INFERNO_CARD ? readInfernoConfig() : null;
  const mountInferno = inferno ? await loadRuido().catch(() => null) : null;

  const rect = card.getBoundingClientRect();
  const radius = getComputedStyle(card).borderTopLeftRadius;
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", preset.name);
  Object.assign(overlay.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: radius,
    zIndex: "100",
    overflow: "hidden",
    background: "#0b0d12",
  });
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
  overlay.append(canvas);

  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";
  Object.assign(close.style, {
    position: "absolute",
    right: "24px",
    top: "24px",
    width: "48px",
    height: "48px",
    borderRadius: "9999px",
    border: "1px solid rgba(255,255,255,.35)",
    background: "rgba(11,13,18,.35)",
    color: "#fff",
    font: "500 18px/1 sans-serif",
    cursor: "pointer",
    opacity: "0",
    backdropFilter: "blur(12px)",
  });
  overlay.append(close);
  document.body.append(overlay);
  document.documentElement.style.overflow = "hidden";

  // Central card: the real inferno shader, frozen (animate "off") while it grows and switched on once it fills the screen.
  let live: { start(): void; stop(): void; destroy(): void } | null;
  if (inferno && mountInferno) {
    const handle = mountInferno(canvas, { ...inferno, animate: "off" });
    live = {
      start: () => handle.setConfig({ ...inferno, animate: "on" }),
      stop: () => handle.setConfig({ ...inferno, animate: "off" }),
      destroy: () => handle.dispose(),
    };
  } else {
    live = mountCardLive(canvas, preset);
  }
  card.style.visibility = "hidden"; // the overlay stands in for it (frame 0 == the still)

  const shut = () => {
    document.removeEventListener("keydown", onKey);
    live?.stop();
    gsap.to(close, { opacity: 0, duration: 0.15 });
    const r = card.getBoundingClientRect(); // the page may have scrolled meanwhile
    gsap.to(overlay, {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      borderRadius: radius,
      duration: reduceMotion() ? 0 : 0.8,
      ease: "expo.inOut",
      onComplete: () => {
        live?.destroy();
        overlay.remove();
        card.style.visibility = "";
        document.documentElement.style.overflow = "";
        opening = false;
      },
    });
  };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && shut();
  document.addEventListener("keydown", onKey);
  close.addEventListener("click", shut);

  gsap.to(overlay, {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    borderRadius: 0,
    duration: reduceMotion() ? 0 : 1.1,
    ease: "expo.inOut",
    onComplete: () => {
      live?.start(); // the gradient only comes alive once the card fills the screen
      gsap.to(close, { opacity: 1, duration: 0.4 });
      close.focus();
    },
  });
}

export function initGradientCards(root: HTMLElement) {
  paintStills(root);
  let timer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => paintStills(root), 200);
  });
  root.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-gcard]");
    if (card) void expand(card);
  });
}
