/* Mouvement : retour au toucher et sorties animées.
   Tout respecte « réduire les animations » du système. */
import type { RefObject } from "preact";
import { useLayoutEffect } from "preact/hooks";

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- retour au toucher ----------
   Dès que le doigt se pose sur un élément cliquable, il se creuse ; il se relâche au
   lever du doigt, ou si l'on part en défilant (on ne déclenche pas un faux appui). */
const PRESSABLE = "button:not(:disabled), .rcard, [role=button], label.btn, label.photo-drop, a.btn";
export function installPressFeedback() {
  let el: HTMLElement | null = null;
  let x = 0,
    y = 0;
  const release = () => {
    if (el) el.classList.remove("pressing");
    el = null;
  };
  addEventListener(
    "pointerdown",
    (e) => {
      if (e.button > 0) return;
      const t = (e.target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null;
      if (!t) return;
      // un bouton DANS une carte : seul le bouton se creuse
      el = t;
      x = e.clientX;
      y = e.clientY;
      t.classList.add("pressing");
    },
    { passive: true }
  );
  addEventListener(
    "pointermove",
    (e) => {
      if (el && (Math.abs(e.clientX - x) > 8 || Math.abs(e.clientY - y) > 8)) release();
    },
    { passive: true }
  );
  ["pointerup", "pointercancel", "dragstart", "blur"].forEach((ev) => addEventListener(ev, release, { passive: true }));
  addEventListener("scroll", release, { passive: true, capture: true });
}

/* ---------- sorties animées ----------
   Quand un écran ou une fenêtre disparaît, on en laisse une copie figée le temps de
   l'animation de sortie : rien ne « claque », sans compliquer l'état de l'appli. */
export function playExit(el: Element | null | undefined, cls: string, ms = 280) {
  if (!el || !(el instanceof HTMLElement) || !el.isConnected || reducedMotion()) return;
  const scroll = el.scrollTop;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.add(cls);
  clone.setAttribute("aria-hidden", "true");
  clone.style.pointerEvents = "none";
  clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  clone.querySelectorAll("video").forEach((v) => v.remove());
  document.body.appendChild(clone);
  clone.scrollTop = scroll;
  setTimeout(() => clone.remove(), ms);
}
/** Joue l'animation `cls` sur une copie de l'élément au moment où le composant disparaît. */
export function useExit(ref: RefObject<HTMLElement>, cls: string, ms = 280, pick?: (el: HTMLElement) => Element | null) {
  useLayoutEffect(
    () => () => {
      const el = ref.current;
      if (el) playExit(pick ? pick(el) : el, cls, ms);
    },
    []
  );
}
