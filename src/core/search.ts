/* Recherche : par nom, par ingrédient(s), tolérante aux fautes de frappe.
   « courgette, feta » -> recettes qui contiennent les DEUX.
   « carbonarra » -> Pâtes à la carbonara. */
import { cuisineDe, cuisineInfo } from "./classify";
import type { Recipe } from "./recipe";
import { distance } from "./suggest";
import { keywords, norm, sing } from "./text";

export function splitTerms(q: string): string[] {
  return norm(q.replace(/\s+(et|avec|\+)\s+/gi, ","))
    .split(/\s*,\s*|\s{2,}/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

const _idx = new WeakMap<Recipe, { nom: string; mots: string[]; ing: string; ingMots: string[]; cat: string; cui: string }>();
function index(r: Recipe) {
  let x = _idx.get(r);
  if (!x) {
    const nom = norm(r.nom);
    const ing = norm(r.ing.map((i) => i.n).join(" | "));
    x = {
      nom,
      mots: nom.split(" ").map(sing),
      ing,
      ingMots: [...new Set(r.ing.flatMap((i) => keywords(i.n)))],
      cat: norm(r.cat),
      cui: norm(cuisineInfo(cuisineDe(r)).nom)
    };
    _idx.set(r, x);
  }
  return x;
}

/** Score de pertinence (0 = ne correspond pas). */
export function matchScore(r: Recipe, query: string): number {
  const q = norm(query);
  if (!q) return 1;
  const x = index(r);
  const terms = splitTerms(query);
  // 1) la requête entière dans le nom : meilleur cas
  if (x.nom.includes(q)) return 100 - Math.min(40, x.nom.indexOf(q));
  // 2) chaque terme doit se retrouver (nom, ingrédient, catégorie ou cuisine)
  let total = 0;
  for (const t of terms.length ? terms : [q]) {
    const ts = t.split(" ").map(sing);
    let s = 0;
    if (x.nom.includes(t)) s = 30;
    else if (x.ing.includes(t)) s = 20;
    else if (x.cat.includes(t) || x.cui.includes(t)) s = 12;
    else if (ts.every((w) => x.mots.includes(w) || x.ingMots.includes(w))) s = 15;
    else {
      // faute de frappe : chaque mot du terme doit être proche d'un mot du nom ou d'un ingrédient
      const max = (w: string) => (w.length <= 4 ? 0 : w.length <= 7 ? 1 : 2);
      const proche = ts.every((w) => max(w) > 0 && [...x.mots, ...x.ingMots].some((m) => distance(w, m, max(w)) <= max(w)));
      if (proche) s = 6;
    }
    if (!s) return 0;
    total += s;
  }
  return total;
}

export function searchRecipes(list: Recipe[], query: string): Recipe[] {
  if (!norm(query)) return list;
  return list
    .map((r) => ({ r, s: matchScore(r, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
}

/** Recommandations d'après l'historique : recettes jamais faites qui partagent des
 *  ingrédients et des catégories avec ce qu'on cuisine. */
export function recommendations(all: Recipe[], byRecipe: Record<string, number>, max = 8): Recipe[] {
  const cookedIds = Object.keys(byRecipe || {});
  if (!cookedIds.length) return [];
  const byId = new Map(all.map((r) => [r.id, r]));
  const ingW: Record<string, number> = {},
    catW: Record<string, number> = {},
    cuiW: Record<string, number> = {};
  cookedIds.forEach((id) => {
    const r = byId.get(id);
    if (!r) return;
    const w = byRecipe[id] || 1;
    catW[r.cat] = (catW[r.cat] || 0) + w;
    cuiW[cuisineDe(r)] = (cuiW[cuisineDe(r)] || 0) + w;
    r.ing.forEach((i) =>
      keywords(i.n).forEach((k) => {
        ingW[k] = (ingW[k] || 0) + w;
      })
    );
  });
  const scored: { r: Recipe; s: number }[] = [];
  all.forEach((r) => {
    if (byRecipe[r.id]) return;
    let s = 0;
    const vus: Record<string, 1> = {};
    r.ing.forEach((i) =>
      keywords(i.n).forEach((k) => {
        if (ingW[k] && !vus[k]) {
          s += ingW[k];
          vus[k] = 1;
        }
      })
    );
    s = s / Math.sqrt(r.ing.length || 1);
    if (catW[r.cat]) s += catW[r.cat] * 0.4;
    if (cuiW[cuisineDe(r)]) s += cuiW[cuisineDe(r)] * 0.3;
    if (s > 0) scored.push({ r, s });
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, max).map((x) => x.r);
}
