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

/* Produits ajoutés en v2 (prix moyens constatés en France, ordre de grandeur). */
const PRIX_PLUS: [RegExp, number, "kg" | "l" | "pc"][] = [
  [/viande hachee|chair a saucisse|agneau hache|poulet hache/, 11, "kg"],
  [/maizena|fecule|tapioca/, 4, "kg"],
  [/menthe|aneth|coriandre fraiche|ciboulette|basilic frais|sauge|estragon/, 1.2, "pc"],
  [/feta|halloumi|paneer/, 12, "kg"],
  [/cheddar|reblochon|raclette|fromage a raclette|bleu d auvergne/, 14, "kg"],
  [/fromage frais|philadelphia|cream cheese/, 9, "kg"],
  [/celeri|fenouil|navet|radis|betterave|panais/, 2.5, "kg"],
  [/sauce poisson|nuoc mam|sauce huitre|sauce worcestershire|sriracha|sauce chili|sauce chili douce/, 8, "l"],
  [/pains? a burger|muffins? anglais|pains? pita|baguette|pain ciabatta|pain de campagne|brioche/, 0.6, "pc"],
  [/pousses de soja|edamame|pois gourmands/, 6, "kg"],
  [/oranges?|clementines?|pamplemousse/, 2.5, "kg"],
  [/brick|feuilles de brick|feuilles de vigne/, 0.25, "pc"],
  [/lard|poitrine fumee|bacon/, 11, "kg"],
  [/garam masala|garam massala|ras el hanout|ras-el-hanout|anis|badiane|cardamome|curcuma|safran/, 30, "kg"],
  [/tahini|puree de sesame/, 10, "kg"],
  [/raisins secs|abricots secs|pruneaux|dattes|figues seches/, 9, "kg"],
  [/gelatine/, 0.3, "pc"],
  [/pignons/, 45, "kg"],
  [/citronnelle/, 0.8, "pc"],
  [/calamars?|encornets?|seiche/, 12, "kg"],
  [/haddock|truite|bar|sardines?|maquereau|dorade/, 18, "kg"],
  [/canard|cuisses de canard|magret/, 15, "kg"],
  [/biscuits?|speculoos|boudoirs|biscuits a la cuillere|meringues?/, 7, "kg"],
  [/yaourts?/, 0.4, "pc"],
  [/endives?|chou kale|kale|blettes/, 3.5, "kg"],
  [/feves|pois casses|haricots noirs|lentilles vertes|lentilles corail/, 3, "kg"],
  [/vermicelles|nouilles de riz|nouilles de riz larges/, 4, "kg"],
  [/kiwis?|mangues?|ananas|fruits de la passion|grenade/, 0.9, "pc"],
  [/raisins?/, 4, "kg"],
  [/cafe|cafe fort/, 15, "kg"],
  [/granola|muesli|cereales/, 6, "kg"],
  [/lait concentre/, 6, "kg"],
  [/noix de cajou|noix de pecan|pistaches|noisettes/, 22, "kg"],
  [/noix de coco|coco rapee/, 9, "kg"],
  [/sirop d erable|sirop/, 15, "l"],
  [/cacao/, 12, "kg"],
  [/tofu/, 9, "kg"],
  [/pate de curry|pate de curry rouge/, 15, "kg"],
  [/vinaigre de riz|vinaigre de xeres|vinaigre balsamique/, 6, "l"],
  [/huile de friture/, 2.5, "l"]
];
/** « avocats » -> « avocat » : la plupart des motifs sont écrits au singulier. */
const singulier = (n: string) =>
  n
    .split(" ")
    .map((w) => (w.length > 3 ? w.replace(/(?:eaux|aux)$/, "al").replace(/[sx]$/, "") : w))
    .join(" ");
export function prixEntry(n: string): [RegExp, number, "kg" | "l" | "pc"] | null {
  return trouve(PRIX, n) || trouve(PRIX_PLUS, n) || trouve(PRIX, singulier(n)) || trouve(PRIX_PLUS, singulier(n));
}

/** Coût estimé d'un ingrédient, en euros ; null si on ne sait pas le chiffrer. */
export function coutIngredient(i: Ingredient, factor = 1): number | null {
  const n = norm(pantryName(i.n));
  const e = prixEntry(n);
  if (!e) return null;
  const [, prix, unite] = e;
  const q = (i.q != null ? i.q : 1) * (factor || 1);
  const fam = unitFamily(i.u),
    petite = SMALL[i.u];
  if (unite === "pc") {
    if (fam === "piece" || !i.u) return prix * q;
    const pp = trouve(POIDS_PIECE, n) || trouve(POIDS_PIECE, singulier(n));
    const kg = fam === "masse" || fam === "volume" ? toBase(q, i.u) / 1000 : 0;
    return pp && kg ? prix * (kg / pp[1]) : prix * q;
  }
  let base: number; // en kg ou en litres
  if (petite) base = (petite.g * q) / 1000;
  else if (fam === "masse" || fam === "volume") base = toBase(q, i.u) / 1000;
  else {
    const pp = trouve(POIDS_PIECE, n) || trouve(POIDS_PIECE, singulier(n));
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
