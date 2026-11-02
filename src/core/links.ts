/* Liens de partage : une recette perso ou un frigo voyagent entiers dans l'adresse.
   Ni serveur ni compte : rien qui puisse fermer, expirer ou devenir payant.
   Le format (v:1) est celui de la première version : les anciens liens restent lisibles. */
import type { FridgeItem } from "./fridge";
import { sanitizeRecipe, type Recipe } from "./recipe";

export function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeRecipe(r: Recipe): string {
  const d = {
    v: 1,
    n: r.nom,
    e: r.emoji,
    c: r.cat,
    d: r.diff,
    p: r.prep,
    k: r.cuisson,
    o: r.portions,
    i: r.ing.map((x) => [x.q, x.u, x.n]),
    s: r.etapes,
    ...(r.photo && /^https?:/.test(r.photo) ? { ph: r.photo } : {})
  };
  return b64url(JSON.stringify(d));
}
export function decodeRecipe(raw: string | null): Recipe | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(unb64url(raw));
    if (!d || d.v !== 1) return null;
    return sanitizeRecipe({
      nom: d.n,
      emoji: d.e,
      cat: d.c,
      diff: d.d,
      prep: d.p,
      cuisson: d.k,
      portions: d.o,
      photo: d.ph,
      ing: (Array.isArray(d.i) ? d.i : []).map((a: any[]) => ({ q: a[0], u: a[1], n: a[2] })),
      etapes: d.s
    });
  } catch {
    return null;
  }
}

export interface ShoppingItemLite {
  label: string;
  base: string;
  q: number | null;
  u: string;
  from: string;
  checked: boolean;
}
export interface SyncData {
  fridge: FridgeItem[];
  shopping: ShoppingItemLite[];
}
/** Forme compacte en tableaux : un lien collable dans un message doit rester court. */
export function encodeSync(fridge: FridgeItem[], shopping: ShoppingItemLite[]): string {
  const data = {
    v: 1,
    f: fridge.map((x) => (x.exp ? [x.n, x.q, x.u, x.exp] : [x.n, x.q, x.u])),
    s: shopping.map((x) => [x.label, x.base, x.q, x.u, x.from, x.checked ? 1 : 0])
  };
  return b64url(JSON.stringify(data));
}
export function decodeSync(raw: string | null): SyncData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(unb64url(raw));
    if (!d || d.v !== 1 || !Array.isArray(d.f) || !Array.isArray(d.s)) return null;
    const ok = (a: unknown): a is any[] => Array.isArray(a) && typeof a[0] === "string" && !!a[0];
    return {
      fridge: d.f
        .filter(ok)
        .slice(0, 300)
        .map((a: any[]) => ({ n: String(a[0]).slice(0, 80), q: typeof a[1] === "number" ? a[1] : null, u: String(a[2] || ""), exp: typeof a[3] === "string" ? a[3] : null })),
      shopping: d.s
        .filter(ok)
        .slice(0, 300)
        .map((a: any[]) => ({
          label: String(a[0]).slice(0, 80),
          base: String(a[1] || a[0]).slice(0, 80),
          q: typeof a[2] === "number" ? a[2] : null,
          u: String(a[3] || ""),
          from: String(a[4] || "").slice(0, 80),
          checked: !!a[5]
        }))
    };
  } catch {
    return null;
  }
}

/** Accepte une URL complète, ou seulement le morceau contenant le paramètre. */
export function parseIncomingLink(txt: string): { rp: string | null; sync: string | null; r: string | null } {
  const s = (txt || "").trim();
  let rp: string | null = null,
    sync: string | null = null,
    r: string | null = null;
  try {
    const u = new URL(s, "https://yummly.fr/");
    rp = u.searchParams.get("rp");
    sync = u.searchParams.get("sync");
    r = u.searchParams.get("r");
  } catch {
    /* ignore */
  }
  if (!rp && !sync && !r) {
    const m = s.match(/[?&](rp|sync|r)=([^&\s]+)/);
    if (m) {
      if (m[1] === "rp") rp = m[2];
      else if (m[1] === "sync") sync = m[2];
      else r = decodeURIComponent(m[2]);
    }
  }
  return { rp, sync, r };
}
