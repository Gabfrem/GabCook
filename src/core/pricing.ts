/* ================= ESTIMATION DU PRIX D'UNE RECETTE =================
   Prix moyens INTÉGRÉS à l'application, pas des prix relevés en magasin. Le comparatif
   applique un indice par enseigne : c'est un ordre de grandeur, pas un relevé à l'euro près. */
import { pantryName } from "./ingredients";
import type { Ingredient, Recipe } from "./recipe";
import { ENSEIGNES, POIDS_PIECE, PRIX, SMALL } from "./tables";
import { norm } from "./text";
import { toBase, unitFamily } from "./units";

export { ENSEIGNES };

/* Comparaison en MOTS ENTIERS : sans cela « bŒUF haché » tombait dans le motif des « œufs ». */
const _bord = new WeakMap<object, RegExp>();
export function trouve<T extends [RegExp, ...unknown[]]>(liste: T[], n: string): T | null {
  for (const e of liste) {
    let re = _bord.get(e);
    if (!re) {
      re = new RegExp("(^|\\s)(?:" + e[0].source + ")(?=$|\\s)", "i");
      _bord.set(e, re);
    }
    if (re.test(n)) return e;
  }
  return null;
}

/** Coût estimé d'un ingrédient, en euros ; null si on ne sait pas le chiffrer. */
export function coutIngredient(i: Ingredient, factor = 1): number | null {
  const n = norm(pantryName(i.n));
  const e = trouve(PRIX, n);
  if (!e) return null;
  const [, prix, unite] = e;
  const q = (i.q != null ? i.q : 1) * (factor || 1);
  const fam = unitFamily(i.u),
    petite = SMALL[i.u];
  if (unite === "pc") {
    if (fam === "piece" || !i.u) return prix * q;
    const pp = trouve(POIDS_PIECE, n);
    const kg = fam === "masse" || fam === "volume" ? toBase(q, i.u) / 1000 : 0;
    return pp && kg ? prix * (kg / pp[1]) : prix * q;
  }
  let base: number; // en kg ou en litres
  if (petite) base = (petite.g * q) / 1000;
  else if (fam === "masse" || fam === "volume") base = toBase(q, i.u) / 1000;
  else {
    const pp = trouve(POIDS_PIECE, n);
    base = q * (pp ? pp[1] : 0.15);
  }
  return prix * base;
}

export interface Price {
  total: number;
  parPers: number;
  inconnus: number;
}
const _prixMemo = new WeakMap<Recipe, Price>();
/** Prix total et par personne d'une recette (portions d'origine). */
export function prixRecette(r: Recipe): Price {
  const hit = _prixMemo.get(r);
  if (hit) return hit;
  let total = 0,
    inconnus = 0;
  r.ing.forEach((i) => {
    const c = coutIngredient(i, 1);
    if (c == null) inconnus++;
    else total += c;
  });
  const res = { total, parPers: total / (r.portions || 1), inconnus };
  _prixMemo.set(r, res);
  return res;
}

export function euros(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2).replace(".", ",") + " €";
}

export interface ShoppingLike {
  label: string;
  base?: string;
  q: number | null;
  u: string;
  checked?: boolean;
}
export function prixCourses(list: ShoppingLike[]) {
  let total = 0,
    reste = 0,
    inconnus = 0;
  list.forEach((s) => {
    const c = coutIngredient({ n: s.base || s.label, q: s.q, u: s.u || "" }, 1);
    if (c == null) {
      inconnus++;
      return;
    }
    total += c;
    if (!s.checked) reste += c;
  });
  return { total, reste, inconnus };
}

export const cheapestStore = () => ENSEIGNES.reduce((a, b) => (b[1] < a[1] ? b : a));
export const priciestStore = () => ENSEIGNES.reduce((a, b) => (b[1] > a[1] ? b : a));
