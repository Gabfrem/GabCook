/* Unités, conversions et affichage des quantités. */

export type UnitFamily = "masse" | "volume" | "piece" | null;

/** Unités proposées dans les listes déroulantes (frigo, courses). */
export const UNIT_OPTS: [string, string][] = [
  ["", "pièce"],
  ["g", "g"],
  ["kg", "kg"],
  ["ml", "ml"],
  ["cl", "cl"],
  ["l", "l"]
];

/** Unités proposées dans l'éditeur de recette (mesures de cuisine en plus). */
export const RECIPE_UNITS: [string, string][] = [
  ...UNIT_OPTS,
  ["c. à café", "c. à café"],
  ["c. à soupe", "c. à soupe"],
  ["pincée", "pincée"],
  ["poignée", "poignée"],
  ["sachet", "sachet"]
];

export function unitFactor(u: string): number | null {
  switch (u) {
    case "g":
      return 1;
    case "kg":
      return 1000;
    case "ml":
      return 1;
    case "cl":
      return 10;
    case "l":
      return 1000;
    case "c. à soupe":
      return 15;
    case "c. à café":
      return 5;
    case "":
      return 1;
    default:
      return null;
  }
}

export function unitFamily(u: string): UnitFamily {
  if (u === "g" || u === "kg") return "masse";
  if (u === "ml" || u === "cl" || u === "l" || u === "c. à soupe" || u === "c. à café") return "volume";
  if (u === "") return "piece";
  return null;
}

export const comparable = (u1: string, u2: string): boolean => {
  const f = unitFamily(u1);
  return !!f && f === unitFamily(u2);
};
export const toBase = (q: number, u: string): number => q * (unitFactor(u) ?? 1);
export const fromBase = (b: number, u: string): number => b / (unitFactor(u) ?? 1);
export const roundNice = (x: number): number => Math.round(x * 100) / 100;

export function parseQty(v: unknown): number | null {
  const s = (v == null ? "" : String(v)).trim().replace(",", ".");
  if (s === "") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** 1.5 -> « 1,5 » ; 2 -> « 2 » */
export function fmtNum(q: number): string {
  q = Math.round(q * 100) / 100;
  if (Number.isInteger(q)) return q.toString();
  const s = q.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",");
}

/** Équivalences approximatives des petites mesures vers masse (g) / volume (ml). */
export const LOOSE = new Set(["pincée", "poignée", "c. à soupe", "c. à café"]);

/** Une recette mise à l'échelle donne des nombres impossibles (66,67 g de beurre) :
 *  on arrondit l'AFFICHAGE à des valeurs qu'une balance ou une cuillère peuvent suivre. */
export function niceQty(q: number, u: string): { q: number; u: string } {
  if (u === "kg" && q < 1) {
    q *= 1000;
    u = "g";
  }
  if (u === "l" && q < 1) {
    q *= 100;
    u = "cl";
  }
  if (u === "" || LOOSE.has(u)) {
    q = Math.round(q * 2) / 2;
    return { q: q < 0.5 ? 0.5 : q, u };
  }
  const step = q >= 200 ? 10 : q >= 50 ? 5 : q >= 10 ? 1 : q >= 2 ? 0.5 : q >= 0.5 ? 0.1 : 0.05;
  const r = Math.round(q / step) * step;
  return { q: r > 0 ? Math.round(r * 1000) / 1000 : step, u };
}

/** Quantité affichée d'un ingrédient pour un facteur de portions donné (« 200 g », « 2 »). */
export function qtyLabel(ing: { q: number | null; u: string }, factor = 1): string {
  if (ing.q == null) return ing.u || "";
  const n = niceQty(ing.q * factor, ing.u);
  return n.u ? fmtNum(n.q) + " " + n.u : fmtNum(n.q);
}

/** Quantité d'un article de frigo / de courses (« 500 g », « 3 »). */
export function qtyShort(q: number | null | undefined, u: string): string {
  if (q == null) return "";
  return fmtNum(q) + (u ? " " + u : "");
}
