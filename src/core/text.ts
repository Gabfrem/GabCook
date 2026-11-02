import { STOP } from "./tables";

/** Minuscules, sans accents ni ponctuation. Les ligatures sont développées avant de
 *  retirer les accents, sinon « œufs » se réduirait à « ufs ». */
export const norm = (s?: string | null): string =>
  (s || "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Singulier approximatif : « oignon » et « oignons » désignent le même produit. */
export const sing = (w: string): string => w.replace(/(?:eaux|aux|x|s)$/, "");

/** Mots significatifs d'un nom de produit (sans contenant, mesure ni article). */
export function keywords(name: string): string[] {
  const all = norm(name)
    .split(" ")
    .filter((w) => w.length > 2);
  const kw = all.filter((w) => !STOP.has(w));
  // si tout a été filtré (« café fort »), on garde les mots bruts plutôt que rien
  return (kw.length ? kw : all).map(sing);
}

export function cap(s?: string | null): string {
  const t = s || "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Tout texte saisi finit affiché : on retire les chevrons et les espaces superflus. */
export function clean(s: unknown): string {
  return (s == null ? "" : String(s)).replace(/[<>]/g, "").trim();
}

/** Empreinte stable d'une chaîne (FNV-1a) : sert à varier les visuels de façon déterministe. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function plural(n: number, one: string, many?: string): string {
  return n > 1 ? many || one + "s" : one;
}

/** « 3 ingrédients », « 1 ingrédient » */
export function count(n: number, one: string, many?: string): string {
  return n + " " + plural(n, one, many);
}

export function uid(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function timeAgo(ts: string | number): string {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) return "il y a " + Math.floor(d / 60) + " min";
  if (d < 86400) return "il y a " + Math.floor(d / 3600) + " h";
  if (d < 172800) return "hier";
  if (d < 604800) return "il y a " + Math.floor(d / 86400) + " j";
  return dateFr(ts);
}

export function dateFr(ts: string | number, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(ts).toLocaleDateString("fr-FR", opts || { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}
