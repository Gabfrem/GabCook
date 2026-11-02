/* ==========================================================================
   NOM GÉNÉRIQUE D'UN INGRÉDIENT
   « 2 gousses d'ail », « ail frais », « blanc de poulet », « oignon rouge »…
   désignent en cuisine l'ail, le poulet, l'oignon. Sans normalisation, chaque
   variante crée une entrée distincte dans le frigo et AUCUNE recette ne sait
   qu'on a le produit. On ramène donc tout à un nom canonique, sans jamais
   fusionner deux produits réellement différents (pommes de terre ≠ pommes,
   lait de coco ≠ lait, haricots verts ≠ haricots).
   ========================================================================== */
import {
  COULEUR_OK,
  FAMILLES,
  GARDER_TEL_QUEL,
  PANTRY,
  PORTIONS,
  QUALIF_ING,
  SYNONYMES,
  TAILLE,
  UNITES_TXT
} from "./tables";
import { keywords, norm } from "./text";

export function canonIngredient(nom: string): string {
  let n = (nom || "").trim().replace(/\s+/g, " ");
  if (!n) return "";
  if (GARDER_TEL_QUEL.some((re) => re.test(n))) return n.toLowerCase();
  // les synonymes passent AVANT le nettoyage : « crème liquide » doit être reconnue
  // avant que le qualificatif ne soit retiré
  for (const [re, v] of SYNONYMES) if (re.test(n)) return v;
  const av = n;
  n = n.replace(PORTIONS, ""); // « 2 gousses d'ail » → « ail »
  n = n.replace(TAILLE, ""); // « petits oignons » → « oignons »
  n = n.replace(COULEUR_OK, (_m, p) => p); // « oignon rouge » → « oignon »
  n = n.replace(QUALIF_ING, "$1").replace(/\s+/g, " ").replace(/\s*,\s*$/, "").trim();
  n = n.replace(/^(?:de |d[’']|du |des |la |le |les )/i, "").trim();
  if (!n) n = av; // tout a été mangé : on garde l'original
  for (const [re, v] of SYNONYMES) if (re.test(n)) return v;
  return n.toLowerCase();
}

export interface PantryInfo {
  /** nom du produit tel qu'on l'achète et qu'on le range */
  n: string;
  /** singulier, pour « 1 œuf » */
  n1: string | null;
  /** le nom est déclaré : la correspondance doit être exacte */
  strict: boolean;
  /** la recette n'utilise qu'une partie du produit (jaunes d'œufs) */
  part: boolean;
}

const _pantryMemo = new Map<string, PantryInfo>();
export function pantryOf(name: string): PantryInfo {
  const n = (name || "").trim();
  const hit = _pantryMemo.get(n);
  if (hit) return hit;
  let res: PantryInfo | null = null;
  for (const p of PANTRY) {
    if (p.re.test(n)) {
      res = { n: n.replace(p.re, p.n), n1: p.n1 ? n.replace(p.re, p.n1) : null, strict: true, part: !!p.part };
      break;
    }
  }
  if (!res) res = { n: canonIngredient(n), n1: null, strict: false, part: false };
  if (_pantryMemo.size > 5000) _pantryMemo.clear();
  _pantryMemo.set(n, res);
  return res;
}
export const pantryName = (name: string): string => pantryOf(name).n;

/** Clé de comparaison d'un produit : ses mots significatifs triés. */
export function ingKey(name: string): string {
  return [...keywords(pantryName(name))].sort().join(" ");
}

// « pâtes » -> « pates », pour comparer sans espaces ni accents
const cleFam = (s: string) => norm(s).replace(/[^a-z0-9]/g, "");

/** Le nom du frigo est-il le générique d'une famille dont l'ingrédient fait partie ?
 *  (avoir des pâtes couvre les spaghetti ; l'inverse n'est pas vrai) */
export function familleCouvre(nomFrigo: string, nomRecette: string): boolean {
  const g = cleFam(nomFrigo),
    m = cleFam(nomRecette);
  return FAMILLES.some((f) => f.gen.test(g) && f.membres.test(m));
}

/** `a` vient de la recette, `b` du frigo. Un article du frigo couvre un ingrédient si
 *  tous ses mots se retrouvent dans celui-ci : « Poivron » couvre « poivron rouge »,
 *  mais « Pommes » ne couvre pas « pommes de terre ». */
export function sameProduct(a: string, b: string): boolean {
  const pa = pantryOf(a),
    pb = pantryOf(b);
  const ka = keywords(pa.n),
    kb = keywords(pb.n);
  if (!ka.length || !kb.length) return false;
  if (familleCouvre(pb.n, pa.n)) return true;
  if (pa.strict || pb.strict) return ingKey(a) === ingKey(b);
  return kb.every((w) => ka.includes(w));
}

/** La quantité tapée dans le champ du nom en est extraite : « bœuf 500g » devient
 *  l'article « bœuf » avec 500 g à côté. */
export function separeQuantite(txt: string): { n: string; q: number | null; u: string } {
  const r = separeQuantiteBrut(txt);
  // dl et mg ne sont pas des unités de l'application : on convertit
  if (r.u === "dl" && r.q != null) return { ...r, q: r.q * 10, u: "cl" };
  if (r.u === "mg" && r.q != null) return { ...r, q: r.q / 1000, u: "g" };
  return r;
}
function separeQuantiteBrut(txt: string): { n: string; q: number | null; u: string } {
  const n0 = (txt || "").trim().replace(/\s+/g, " ");
  if (!n0) return { n: "", q: null, u: "" };
  const num = "(\\d+(?:[.,]\\d+)?)",
    art = "(?:de\\s+|d[’']\\s*|du\\s+|des\\s+)?";
  const val = (s: string) => parseFloat(String(s).replace(",", "."));
  let m: RegExpMatchArray | null;
  if ((m = n0.match(new RegExp("^" + num + "\\s*(" + UNITES_TXT + ")\\b\\s*" + art + "(.+)$", "i"))))
    return { q: val(m[1]), u: m[2].toLowerCase(), n: m[3].trim() };
  if ((m = n0.match(new RegExp("^(.+?)\\s+" + num + "\\s*(" + UNITES_TXT + ")$", "i"))))
    return { q: val(m[2]), u: m[3].toLowerCase(), n: m[1].trim() };
  if ((m = n0.match(new RegExp("^(.+?)\\s*[x×]\\s*" + num + "$", "i")))) return { q: val(m[2]), u: "", n: m[1].trim() };
  if ((m = n0.match(new RegExp("^" + num + "\\s+" + art + "(.+)$", "i")))) return { q: val(m[1]), u: "", n: m[2].trim() };
  return { n: n0, q: null, u: "" };
}
