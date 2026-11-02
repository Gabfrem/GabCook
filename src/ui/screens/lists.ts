/* Sélections de recettes partagées par l'accueil et l'exploration. */
import { cuisineDe, isVege } from "../../core/classify";
import { missingImportant, recipeUses, urgentItems } from "../../core/fridge";
import { prixRecette } from "../../core/pricing";
import { airFryerOk, microOk, totalTime, viewOf, type Recipe } from "../../core/recipe";
import { recommendations } from "../../core/search";
import { isDeSaison } from "../../core/seasons";
import { hashStr } from "../../core/text";
import { fitsMe, globalRating, isFav, isPlanned, lastCooked, scoreNote } from "../../state/actions";
import { AF, allRecipes, cookMode, favorites, fridge, MO, perso, planned, stats } from "../../state/store";
import type { ExplorePreset } from "../../state/ui";

/** Toutes les recettes compatibles avec le mode de cuisson et mes préférences. */
export function baseList(): Recipe[] {
  const m = cookMode.value;
  return allRecipes.value.filter((r) => (m === "airfryer" ? airFryerOk(r, AF.value) : m === "micro" ? microOk(r, MO.value) : true) && fitsMe(r));
}
export const minutes = (r: Recipe) => totalTime(r, viewOf(r, cookMode.value, AF.value, MO.value).cuisson);
const hasPhoto = (r: Recipe) => !!r.photo;

export function cookable(list: Recipe[]): Recipe[] {
  if (!fridge.value.length) return [];
  return list.filter((r) => missingImportant(fridge.value, r).length === 0);
}

/** Note de pertinence pour « ce soir ». */
function scoreSoir(r: Recipe, urgent: ReturnType<typeof urgentItems>): number {
  let s = scoreNote(r.id) || 3;
  if (hasPhoto(r)) s += 1.2;
  if (isFav(r.id)) s += 0.6;
  if (isPlanned(r.id)) s += 1.5;
  s += urgent.filter((u) => recipeUses(r, u)).length * 2.5;
  const last = lastCooked(r.id);
  if (last && Date.now() - last < 7 * 86400000) s -= 4;
  const t = minutes(r);
  if (t <= 40) s += 0.5;
  return s;
}

/** Idée pour ce soir : d'abord ce qu'on peut cuisiner, en écoulant ce qui va périmer. */
export function tonightIdeas(seed: number): { r: Recipe; ready: boolean; missing: number }[] {
  const list = baseList().filter((r) => r.cat === "Plat");
  const urgent = urgentItems(fridge.value);
  const f = fridge.value;
  let pool: { r: Recipe; ready: boolean; missing: number; s: number }[];
  if (f.length) {
    pool = list
      .map((r) => {
        const m = missingImportant(f, r).length;
        return { r, ready: m === 0, missing: m, s: scoreSoir(r, urgent) - m * 2.2 };
      })
      .filter((x) => x.missing <= 2);
  } else pool = [];
  if (pool.length < 3) {
    // frigo vide : une sélection du jour (photo, de saison, bien notée), stable sur la journée
    const jour = new Date().toDateString();
    pool = list
      .filter(hasPhoto)
      .map((r) => ({ r, ready: false, missing: -1, s: (isDeSaison(r) ? 2 : 0) + (scoreNote(r.id) || 3) + ((hashStr(r.id + jour) % 100) / 100) * 3 }));
  }
  pool.sort((a, b) => b.s - a.s);
  const top = pool.slice(0, 12);
  // rotation à chaque « une autre idée »
  const k = top.length ? seed % top.length : 0;
  return top.slice(k).concat(top.slice(0, k)).map(({ r, ready, missing }) => ({ r, ready, missing }));
}

export function recommended(max = 12): Recipe[] {
  const base = baseList();
  let recos = recommendations(base, stats.value.byRecipe, max);
  if (recos.length < max) {
    const vus = new Set(recos.map((r) => r.id));
    const rest = base
      .filter((r) => !vus.has(r.id) && r.cat === "Plat" && hasPhoto(r))
      .sort((a, b) => scoreNote(b.id) - scoreNote(a.id) || hashStr(a.id + new Date().toDateString()) - hashStr(b.id + new Date().toDateString()));
    recos = recos.concat(rest.slice(0, max - recos.length));
  }
  return recos;
}

export const seasonal = (max = 12) =>
  baseList()
    .filter((r) => isDeSaison(r) && (r.cat === "Plat" || r.cat === "Entrée" || r.cat === "Dessert"))
    .sort((a, b) => Number(hasPhoto(b)) - Number(hasPhoto(a)) || scoreNote(b.id) - scoreNote(a.id))
    .slice(0, max);
export const quick = (max = 12) =>
  baseList()
    .filter((r) => r.cat === "Plat" && minutes(r) <= 20)
    .sort((a, b) => Number(hasPhoto(b)) - Number(hasPhoto(a)) || minutes(a) - minutes(b))
    .slice(0, max);
/** Nouveautés : un mélange qui change chaque jour, en alternant les catégories
   (sinon l'étagère ne montrerait que les premiers plats du fichier). */
export const fresh = (max = 12) => {
  const jour = new Date().toDateString();
  const parCat = new Map<string, Recipe[]>();
  baseList()
    .filter((r) => r.nouveau)
    .sort((a, b) => hashStr(a.id + jour) - hashStr(b.id + jour))
    .forEach((r) => parCat.set(r.cat, [...(parCat.get(r.cat) || []), r]));
  const files = [...parCat.values()];
  const out: Recipe[] = [];
  for (let i = 0; out.length < max && files.some((f) => f.length > i); i++) for (const f of files) if (f[i] && out.length < max) out.push(f[i]);
  return out;
};
export const favList = () => favorites.value.map((id) => allRecipes.value.find((r) => r.id === id)).filter((r): r is Recipe => !!r);
export const plannedList = () => planned.value.map((id) => allRecipes.value.find((r) => r.id === id)).filter((r): r is Recipe => !!r);
export const topRated = (max = 12) =>
  baseList()
    .filter((r) => globalRating(r.id).n > 0)
    .sort((a, b) => scoreNote(b.id) - scoreNote(a.id))
    .slice(0, max);
export const antiGaspi = () => {
  const urgent = urgentItems(fridge.value);
  if (!urgent.length) return [];
  return baseList()
    .map((r) => ({ r, n: urgent.filter((u) => recipeUses(r, u)).length, m: missingImportant(fridge.value, r).length }))
    .filter((x) => x.n > 0 && x.m <= 2)
    .sort((a, b) => b.n - a.n || a.m - b.m)
    .map((x) => x.r);
};

/* ---------- filtres de l'exploration ---------- */
export interface Filters {
  cat: string;
  temps: "" | "court" | "moyen" | "long";
  diff: string;
  vege: boolean;
  prix: string;
  cuisine: string;
  cookable: boolean;
  fav: boolean;
  mine: boolean;
  saison: boolean;
  nouveau: boolean;
  antigaspi: boolean;
  planned: boolean;
}
export const emptyFilters = (): Filters => ({
  cat: "",
  temps: "",
  diff: "",
  vege: false,
  prix: "",
  cuisine: "",
  cookable: false,
  fav: false,
  mine: false,
  saison: false,
  nouveau: false,
  antigaspi: false,
  planned: false
});
export function presetFilters(p?: ExplorePreset): Partial<Filters> {
  switch (p) {
    case "cookable":
      return { cookable: true };
    case "favorites":
      return { fav: true };
    case "mine":
      return { mine: true };
    case "saison":
      return { saison: true };
    case "rapide":
      return { temps: "court" };
    case "nouveau":
      return { nouveau: true };
    case "vege":
      return { vege: true };
    case "antigaspi":
      return { antigaspi: true };
    case "planned":
      return { planned: true };
    default:
      return {};
  }
}
export function applyFilters(list: Recipe[], f: Filters): Recipe[] {
  const urgent = f.antigaspi ? urgentItems(fridge.value) : [];
  return list.filter((r) => {
    if (f.cat && r.cat !== f.cat) return false;
    const t = minutes(r);
    if (f.temps === "court" && t > 20) return false;
    if (f.temps === "moyen" && (t <= 20 || t > 45)) return false;
    if (f.temps === "long" && t <= 45) return false;
    if (f.diff && r.diff !== f.diff) return false;
    if (f.vege && !isVege(r)) return false;
    if (f.prix && prixRecette(r).parPers > +f.prix) return false;
    if (f.cuisine && cuisineDe(r) !== f.cuisine) return false;
    if (f.cookable && (!fridge.value.length || missingImportant(fridge.value, r).length > 0)) return false;
    if (f.fav && !isFav(r.id)) return false;
    if (f.mine && !r.perso) return false;
    if (f.saison && !isDeSaison(r)) return false;
    if (f.nouveau && !r.nouveau) return false;
    if (f.antigaspi && (!urgent.some((u) => recipeUses(r, u)) || missingImportant(fridge.value, r).length > 2)) return false;
    if (f.planned && !isPlanned(r.id)) return false;
    return true;
  });
}
export type Sort = "pertinence" | "note" | "rapide" | "facile" | "prix" | "az";
export function sortList(list: Recipe[], s: Sort): Recipe[] {
  const a = list.slice();
  if (s === "note") a.sort((x, y) => scoreNote(y.id) - scoreNote(x.id) || Number(hasPhoto(y)) - Number(hasPhoto(x)));
  else if (s === "rapide") a.sort((x, y) => minutes(x) - minutes(y));
  else if (s === "facile") {
    const D: Record<string, number> = { Facile: 0, Moyen: 1, Difficile: 2 };
    a.sort((x, y) => (D[x.diff] ?? 9) - (D[y.diff] ?? 9) || minutes(x) - minutes(y));
  }
  else if (s === "prix") a.sort((x, y) => prixRecette(x).parPers - prixRecette(y).parPers);
  else if (s === "az") a.sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  else
    a.sort(
      (x, y) =>
        Number(isPlanned(y.id)) - Number(isPlanned(x.id)) ||
        Number(hasPhoto(y)) - Number(hasPhoto(x)) ||
        scoreNote(y.id) - scoreNote(x.id) ||
        x.nom.localeCompare(y.nom, "fr")
    );
  return a;
}
export const hasPerso = () => perso.value.length > 0;
