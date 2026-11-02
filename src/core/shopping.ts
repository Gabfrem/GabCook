/* Liste de courses : ajout fusionné, besoins de plusieurs recettes, regroupement par rayon. */
import { aisleOf, AISLES, type AisleId } from "./catalog";
import { findFridge, ingStatus, isPantryStaple, type FridgeItem } from "./fridge";
import { ingKey, pantryOf } from "./ingredients";
import type { Recipe } from "./recipe";
import { cap } from "./text";
import { comparable, fromBase, niceQty, roundNice, toBase, unitFamily } from "./units";

export interface ShopItem {
  id: number;
  label: string;
  base: string;
  q: number | null;
  u: string;
  from: string;
  checked: boolean;
}

export const nextId = (list: ShopItem[]) => list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;

/** Ajoute un article ; s'il existe déjà (même produit), on cumule la quantité. */
export function mergeItem(list: ShopItem[], it: Omit<ShopItem, "id" | "checked"> & { checked?: boolean }): { list: ShopItem[]; merged: boolean } {
  const next = list.map((x) => ({ ...x }));
  const ex = next.find((s) => ingKey(s.base) === ingKey(it.base));
  if (ex) {
    if (it.q != null && ex.q != null && comparable(ex.u, it.u)) ex.q = roundNice(fromBase(toBase(ex.q, ex.u) + toBase(it.q, it.u), ex.u));
    else if (it.q != null && ex.q == null) {
      ex.q = it.q;
      ex.u = it.u;
    }
    if (it.from && ex.from && !ex.from.includes(it.from)) ex.from = /plats$/.test(ex.from) ? ex.from : "plusieurs plats";
    ex.checked = false;
    return { list: next, merged: true };
  }
  next.push({ id: nextId(next), label: it.label, base: it.base, q: it.q, u: it.u, from: it.from, checked: !!it.checked });
  return { list: next, merged: false };
}

/** Les ingrédients manquants d'une recette (ou tous si le frigo est vide), prêts à acheter. */
export function missingAsItems(r: Recipe, factor: number, fridge: FridgeItem[]): Omit<ShopItem, "id" | "checked">[] {
  const out: Omit<ShopItem, "id" | "checked">[] = [];
  for (const i of r.ing) {
    // sel, poivre, huile… : on les a presque toujours, on ne les rachète pas à chaque recette
    if (isPantryStaple(i.n)) continue;
    const st = fridge.length ? ingStatus(fridge, i, factor) : { s: "missing" as const };
    if (st.s === "have") continue;
    const p = pantryOf(i.n);
    // on achète le produit entier, sous son nom générique : « 2 gousses d'ail » -> « Ail »
    const nom = (n: number) => (p.part && p.n1 && Math.abs(n) <= 1 ? p.n1 : p.n);
    let q: number | null, u: string, label: string;
    if (st.s === "low" && st.f && st.short != null) {
      const n = niceQty(fromBase(st.short, st.f.u), st.f.u);
      q = n.q;
      u = n.u;
      label = cap(nom(q));
    } else if (i.q == null) {
      q = null;
      u = i.u || "";
      label = cap(nom(1));
    } else {
      const n = niceQty(i.q * factor, i.u);
      q = n.q;
      u = n.u;
      label = cap(nom(q));
    }
    out.push({ label, base: p.n, q, u, from: r.nom });
  }
  return out;
}

/** Besoins cumulés de plusieurs recettes, déduction faite du frigo (semaine -> courses). */
export function aggregateNeeds(recipes: { r: Recipe; factor: number }[], fridge: FridgeItem[]): { items: Omit<ShopItem, "id" | "checked">[]; couverts: number } {
  type E = { nom: string; base: number; u: string; fam: string | null; quantifie: boolean; pour: Set<string> };
  const besoins = new Map<string, E>();
  for (const { r, factor } of recipes) {
    for (const i of r.ing) {
      if (isPantryStaple(i.n)) continue;
      const p = pantryOf(i.n),
        cle = ingKey(p.n);
      const fam = unitFamily(i.u);
      let e = besoins.get(cle);
      if (!e) {
        e = { nom: p.n, base: 0, u: i.u || "", fam, quantifie: i.q != null && !!fam, pour: new Set() };
        besoins.set(cle, e);
      }
      e.pour.add(r.nom);
      if (i.q != null && fam && e.fam === fam) e.base += toBase(i.q * factor, i.u);
      else e.quantifie = false;
    }
  }
  const items: Omit<ShopItem, "id" | "checked">[] = [];
  let couverts = 0;
  besoins.forEach((e) => {
    const f = findFridge(fridge, e.nom);
    let manque = e.base;
    if (f && f.q == null) {
      couverts++;
      return;
    }
    if (f && e.quantifie && comparable(f.u, e.u)) manque = e.base - toBase(f.q!, f.u);
    else if (f) {
      couverts++;
      return;
    }
    if (e.quantifie && manque <= 0.0001) {
      couverts++;
      return;
    }
    const n = e.quantifie ? niceQty(fromBase(manque, e.u), e.u) : null;
    const pour = [...e.pour];
    items.push({
      label: cap(e.nom),
      base: e.nom,
      q: n ? n.q : null,
      u: n ? n.u : e.u || "",
      from: pour.length > 1 ? pour.length + " plats" : pour[0] || ""
    });
  });
  return { items, couverts };
}

/** Regroupe la liste par rayon, dans l'ordre d'un parcours en magasin. */
export function byAisle<T extends { base: string; label: string }>(list: T[]): { aisle: AisleId; nom: string; emoji: string; items: T[] }[] {
  const groups = new Map<AisleId, T[]>();
  for (const it of list) {
    const a = aisleOf(it.base || it.label);
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a)!.push(it);
  }
  return AISLES.filter((a) => groups.has(a.id)).map((a) => ({ aisle: a.id, nom: a.nom, emoji: a.emoji, items: groups.get(a.id)! }));
}

/** Texte partageable de la liste (SMS, WhatsApp…). */
export function shoppingText(list: ShopItem[]): string {
  const lignes = ["🛒 Liste de courses Yummly", ""];
  for (const g of byAisle(list.filter((s) => !s.checked))) {
    lignes.push(g.emoji + " " + g.nom);
    for (const s of g.items) lignes.push("• " + s.label + (s.q != null ? " — " + String(s.q).replace(".", ",") + (s.u ? " " + s.u : "") : ""));
    lignes.push("");
  }
  return lignes.join("\n").trim();
}
