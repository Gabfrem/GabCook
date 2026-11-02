/* Navigation, écrans superposés, messages : l'état de l'interface.
   Chaque écran ouvert par-dessus (recette, mode cuisine, profil…) ajoute une entrée à
   l'historique du navigateur : le bouton retour du téléphone referme un niveau à la fois. */
import { signal } from "@preact/signals";

export type Tab = "home" | "week" | "fridge" | "shopping" | "social";
export const TABS: Tab[] = ["home", "week", "fridge", "shopping", "social"];
export const tab = signal<Tab>("home");

export type Overlay =
  | { kind: "explore"; cat?: string; q?: string; preset?: ExplorePreset; cuisine?: string }
  | { kind: "recipe"; id: string; portions?: number; preview?: boolean }
  | { kind: "cook"; id: string; portions: number }
  | { kind: "editor"; id?: string; importUrl?: string }
  | { kind: "profile"; id: string }
  | { kind: "friends"; id: string; name: string }
  | { kind: "post"; id: string }
  | { kind: "settings" }
  | { kind: "scanner" }
  | { kind: "weekWizard"; step?: number }
  | { kind: "stats" };

export type ExplorePreset = "cookable" | "favorites" | "mine" | "saison" | "rapide" | "nouveau" | "vege" | "antigaspi" | "planned";

export const overlays = signal<Overlay[]>([]);
export const top = () => overlays.value[overlays.value.length - 1] || null;

let ignorePop = 0;
export function openOverlay(o: Overlay) {
  overlays.value = [...overlays.value, o];
  try {
    const url = o.kind === "recipe" && !o.preview ? recipeUrl(o.id, o.portions) : location.pathname;
    history.pushState({ yummly: overlays.value.length }, "", url);
  } catch {
    /* ignore */
  }
}
/** Remplace l'écran du dessus (sans nouvelle entrée d'historique). */
export function replaceTop(o: Overlay) {
  const l = overlays.value.slice(0, -1);
  overlays.value = [...l, o];
}
export function closeOverlay() {
  if (!overlays.value.length) return;
  if (history.state && history.state.yummly) {
    history.back(); // le popstate fera la fermeture
    return;
  }
  overlays.value = overlays.value.slice(0, -1);
}
export function closeAllOverlays() {
  const n = overlays.value.length;
  if (!n) return;
  overlays.value = [];
  try {
    ignorePop += 1;
    history.go(-n);
  } catch {
    ignorePop = 0;
  }
}
export function setTab(t: Tab) {
  if (overlays.value.length) closeAllOverlays();
  tab.value = t;
  try {
    window.scrollTo({ top: 0 });
  } catch {
    /* ignore */
  }
}

/* Une demande de confirmation peut intercepter le retour (quitter l'application). */
export const confirmState = signal<null | {
  title: string;
  text?: string;
  ok: string;
  danger?: boolean;
  cancel?: string;
  onOk: () => void;
  onCancel?: () => void;
}>(null);
export function askConfirm(c: NonNullable<typeof confirmState.value>) {
  confirmState.value = c;
}

export const sheet = signal<null | { kind: string; data?: any }>(null);
export const openSheet = (kind: string, data?: any) => (sheet.value = { kind, data });
export const closeSheet = () => (sheet.value = null);

if (typeof window !== "undefined") {
  addEventListener("popstate", () => {
    if (ignorePop > 0) {
      ignorePop--;
      return;
    }
    if (confirmState.value) {
      confirmState.value = null;
      pushBuffer();
      return;
    }
    if (sheet.value) {
      sheet.value = null;
      pushBuffer();
      return;
    }
    if (overlays.value.length) {
      overlays.value = overlays.value.slice(0, -1);
      return;
    }
    if (tab.value !== "home") {
      tab.value = "home";
      pushBuffer();
      return;
    }
    // accueil : on ne quitte pas sur un simple retour, on redemande
    pushBuffer();
    askConfirm({
      title: "Quitter Yummly ?",
      text: "Ton frigo, tes courses et ta semaine sont enregistrés.",
      ok: "Quitter",
      onOk: () => {
        ignorePop++;
        history.go(-2);
      }
    });
  });
}
/** Entrée tampon : sans elle, le premier retour sortirait de l'application. */
export function pushBuffer() {
  try {
    history.pushState({ yummlyBuffer: 1 }, "", location.pathname + location.search);
  } catch {
    /* ignore */
  }
}

export function recipeUrl(id: string, portions?: number): string {
  let u = location.pathname + "?r=" + encodeURIComponent(id);
  if (portions) u += "&p=" + portions;
  return u;
}

/* ---------- messages éphémères (avec « Annuler ») ---------- */
export const toastState = signal<null | { id: number; msg: string; action?: { label: string; run: () => void } }>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastSeq = 0;
export function toast(msg: string, action?: { label: string; run: () => void }, ms?: number) {
  if (toastTimer) clearTimeout(toastTimer);
  const id = ++toastSeq;
  toastState.value = { id, msg, action };
  toastTimer = setTimeout(() => {
    if (toastState.value && toastState.value.id === id) toastState.value = null;
  }, ms || (action ? 5000 : 2600));
}
export const hideToast = () => (toastState.value = null);
