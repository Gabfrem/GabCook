/* Frigo : correspondance avec les ingrédients des recettes, débit, ajout. Fonctions pures. */
import { familleCouvre, ingKey, pantryName, pantryOf, sameProduct } from "./ingredients";
import type { Ingredient, Recipe } from "./recipe";
import { SMALL } from "./tables";
import { comparable, fromBase, roundNice, toBase, unitFamily } from "./units";

export interface FridgeItem {
  n: string;
  q: number | null;
  u: string;
  /** date limite (AAAA-MM-JJ), facultative */
  exp?: string | null;
  /** date d'ajout (ms) */
  added?: number;
}

export type IngState = "have" | "low" | "missing";
export interface IngStatus {
  s: IngState;
  f?: FridgeItem;
  /** quantité à débiter, dans l'unité de base du frigo */
  debit?: number;
  /** quantité manquante, dans l'unité de base du frigo */
  short?: number;
  /** couvert par un générique (« pâtes » pour des spaghetti) */
  parFamille?: boolean;
}

export function findFridge(fridge: FridgeItem[], ingName: string): FridgeItem | null {
  return fridge.find((f) => sameProduct(ingName, f.n)) || null;
}

/** Quantité requise convertie dans l'unité de base de la famille du frigo (null si non quantifiable). */
export function neededBase(ing: Ingredient, factor: number, fu: string): number | null {
  const fam = unitFamily(fu);
  if (!fam) return null;
  const q = (ing.q != null ? ing.q : 0) * factor;
  if (q <= 0) return 0;
  if (unitFamily(ing.u) === fam) return toBase(q, ing.u);
  const eq = SMALL[ing.u];
  if (eq) {
    if (fam === "masse" && eq.g != null) return q * eq.g;
    if (fam === "volume" && eq.ml != null) return q * eq.ml;
  }
  return null;
}

export function ingStatus(fridge: FridgeItem[], ing: Ingredient, factor = 1): IngStatus {
  const f = findFridge(fridge, ing.n);
  if (!f) return { s: "missing" };
  const parFamille = familleCouvre(pantryOf(f.n).n, pantryOf(ing.n).n) && ingKey(f.n) !== ingKey(ing.n);
  if (f.q == null) return { s: "have", f, debit: 0, parFamille };
  const need = neededBase(ing, factor, f.u);
  if (need == null || need <= 0) return { s: "have", f, debit: 0, parFamille };
  const fBase = toBase(f.q, f.u);
  if (fBase >= need) return { s: "have", f, debit: need, parFamille };
  return { s: "low", f, debit: fBase, short: need - fBase, parFamille };
}

/** Ingrédients que le frigo ne couvre pas (ou pas en quantité suffisante). */
export function missingFor(fridge: FridgeItem[], r: Recipe, factor = 1): Ingredient[] {
  if (!fridge.length) return r.ing.slice();
  return r.ing.filter((i) => ingStatus(fridge, i, factor).s !== "have");
}

/** Ingrédients « de base » qu'on a presque toujours : ils ne bloquent pas une suggestion. */
const BASIQUES = /^(sel|poivre|eau|huile|huile d'olive|sucre|farine|vinaigre|moutarde|herbes de provence|thym|laurier|origan|paprika|cumin|curry|cannelle|muscade|piment|bouillon|levure chimique|ail en poudre)$/;
export const isPantryStaple = (name: string) => BASIQUES.test(pantryName(name).toLowerCase());

/** Ce qui manque vraiment, hors placard de base (sel, poivre, huile…). */
export function missingImportant(fridge: FridgeItem[], r: Recipe): Ingredient[] {
  return missingFor(fridge, r).filter((i) => !isPantryStaple(i.n));
}

/** Débite le frigo pour une recette réalisée. Renvoie un NOUVEAU tableau. */
export function debitFridge(fridge: FridgeItem[], r: Recipe, factor: number): { fridge: FridgeItem[]; changed: number; missing: number } {
  const next = fridge.map((f) => ({ ...f }));
  let changed = 0;
  let missing = 0;
  for (const ing of r.ing) {
    const st = ingStatus(next, ing, factor);
    if (st.s !== "have") missing++;
    if (st.f && st.f.q != null && st.debit && st.debit > 0) {
      const target = st.f;
      const nb = toBase(target.q!, target.u) - st.debit;
      const idx = next.indexOf(target);
      if (nb <= 0.0001) {
        if (idx > -1) next.splice(idx, 1);
      } else {
        target.q = roundNice(fromBase(nb, target.u));
      }
      changed++;
    }
  }
  return { fridge: next, changed, missing };
}

/** Range un produit au frigo : sous son nom générique, en cumulant les quantités. */
export function addToFridge(
  fridge: FridgeItem[],
  name: string,
  q: number | null,
  u: string,
  exp?: string | null
): FridgeItem[] {
  const n = pantryName((name || "").trim());
  if (!n) return fridge;
  u = u || "";
  const next = fridge.map((f) => ({ ...f }));
  const ex = next.find((f) => ingKey(f.n) === ingKey(n));
  if (ex) {
    if (exp && (!ex.exp || exp < ex.exp)) ex.exp = exp; // on garde la date la plus proche
    if (q == null) return next;
    if (ex.q == null) {
      ex.q = roundNice(q);
      ex.u = u;
    } else if (comparable(ex.u, u)) {
      ex.q = roundNice(fromBase(toBase(ex.q, ex.u) + toBase(q, u), ex.u));
    } else {
      ex.q = roundNice(q);
      ex.u = u;
    }
  } else {
    next.push({ n, q: q == null ? null : roundNice(q), u, exp: exp || null, added: Date.now() });
  }
  return next;
}

/* ---------- péremption ---------- */
export function daysUntil(exp: string | null | undefined, today = new Date()): number | null {
  if (!exp) return null;
  const d = new Date(exp + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const t = new Date(today);
  t.setHours(12, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export type Freshness = "expired" | "today" | "soon" | "ok" | null;
export function freshness(exp: string | null | undefined, today = new Date()): Freshness {
  const d = daysUntil(exp, today);
  if (d == null) return null;
  if (d < 0) return "expired";
  if (d === 0) return "today";
  if (d <= 3) return "soon";
  return "ok";
}

export function isoDate(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function addDays(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Produits à consommer en priorité (périmés ou dans les 3 jours), du plus urgent au moins urgent. */
export function urgentItems(fridge: FridgeItem[], today = new Date()): FridgeItem[] {
  return fridge
    .filter((f) => {
      const fr = freshness(f.exp, today);
      return fr === "expired" || fr === "today" || fr === "soon";
    })
    .sort((a, b) => (a.exp || "").localeCompare(b.exp || ""));
}

/** La recette utilise-t-elle ce produit du frigo ? */
export const recipeUses = (r: Recipe, item: FridgeItem) => r.ing.some((i) => sameProduct(i.n, item.n));
