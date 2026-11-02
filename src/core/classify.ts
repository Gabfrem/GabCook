/* Classement des recettes : cuisine d'origine, régime, allergènes, matériel, famille de plat. */
import type { Recipe } from "./recipe";
import { ALLERGENES, AVERSIONS, CUISINE_FORCE, CUISINES, EQUIPEMENTS, NON_VEGE } from "./tables";
import { norm } from "./text";

export { ALLERGENES, AVERSIONS, CUISINES, EQUIPEMENTS };

function memo<T>(fn: (r: Recipe) => T): (r: Recipe) => T {
  const m = new WeakMap<Recipe, T>();
  return (r: Recipe) => {
    if (m.has(r)) return m.get(r)!;
    const v = fn(r);
    m.set(r, v);
    return v;
  };
}

/** Texte complet d'une recette (ingrédients + nom), normalisé. */
export const texteRecette = memo((r: Recipe) => norm(r.ing.map((i) => i.n).join(" ") + " " + r.nom));
export const texteEtapes = memo((r: Recipe) => norm((r.etapes || []).join(" ")));

/** Origine du plat (très générale) : filtre « Cuisine » et planificateur. */
export const cuisineDe = memo((r: Recipe): string => {
  if (CUISINE_FORCE[r.id]) return CUISINE_FORCE[r.id];
  const t = norm(r.nom + " " + r.ing.map((i) => i.n).join(" "));
  for (const c of CUISINES) if (c.id !== "fr" && c.re.test(t)) return c.id;
  return "fr";
});
export const cuisineInfo = (id: string) => CUISINES.find((c) => c.id === id) || CUISINES[CUISINES.length - 1];

/* Mots de chair animale comparés en MOTS ENTIERS : « pâte brisée » n'est pas du « pâté ». */
const NON_VEGE_RE = new RegExp(
  "(^|\\s)(" + NON_VEGE.map((m) => norm(m).replace(/\s+/g, "\\s+")).join("|") + ")(s?)($|\\s)",
  "i"
);
export const isVege = memo((r: Recipe) => !r.ing.some((i) => NON_VEGE_RE.test(norm(i.n))));

/** Allergènes présents (ids de ALLERGENES). */
export const allergensOf = memo((r: Recipe) => ALLERGENES.filter((a) => a.re.test(texteRecette(r))).map((a) => a.id));
/** Aliments « détestés » présents (ids de AVERSIONS). */
export const aversionsOf = memo((r: Recipe) => AVERSIONS.filter((a) => a.re.test(texteRecette(r))).map((a) => a.id));

/** Matériel nécessaire, déduit des étapes. */
export const besoinsRecette = memo((r: Recipe): string[] => {
  const e = texteEtapes(r),
    b: string[] = [];
  if (/\bfour\b|enfourn|prechauffez le four|gratin/.test(e) && !/air fryer/.test(e)) b.push("four");
  if (/micro-?ondes/.test(e)) b.push("micro");
  if (/mixe|blender|mixeur|robot/.test(e)) b.push("mixeur");
  if (/cocotte|faitout|marmite/.test(e)) b.push("cocotte");
  if (/poele|casserole|feu (vif|moyen|doux)|sauteuse|wok|faites (revenir|chauffer|dorer)|ebullition/.test(e)) b.push("plaques");
  return b;
});

/** Famille du plat, pour varier une semaine : protéine principale sinon base. */
export const familleRepas = memo((r: Recipe): string => {
  const t = texteRecette(r);
  if (/\b(saumon|thon|cabillaud|colin|truite|merlu|lieu|poissons?|crevettes?|gambas|moules|calamars?|fruits de mer|sardines?|morue|haddock|dorade|bar)\b/.test(t))
    return "poisson";
  if (/\b(poulet|dinde|volaille|canard|pintade)\b/.test(t)) return "volaille";
  if (/\b(boeuf|steaks?|veau|agneau|hache|haches|kefta|merguez)\b/.test(t)) return "viande rouge";
  if (/\b(porc|lardons?|jambon|saucisses?|chorizo|bacon|travers|echine|poitrine)\b/.test(t)) return "porc";
  if (/\b(pates|spaghetti|tagliatelle|penne|macaroni|nouilles|lasagnes?|gnocchis?|tortellinis?|fusilli|linguine|orecchiette|cannellonis?)\b/.test(t))
    return "pâtes";
  if (/\b(riz|risotto)\b/.test(t)) return "riz";
  if (/\b(oeufs?)\b/.test(t)) return "œufs";
  if (/\b(lentilles|pois chiches|haricots)\b/.test(t)) return "légumineuses";
  return "légumes";
});

/** Une recette est-elle compatible avec un régime / des allergies / des aversions ? */
export interface DietPrefs {
  vege?: boolean;
  allerg: string[];
  deteste: string[];
}
export function respectsDiet(r: Recipe, p: DietPrefs | null | undefined): boolean {
  if (!p) return true;
  if (p.vege && !isVege(r)) return false;
  if (p.allerg && p.allerg.length) {
    const a = allergensOf(r);
    if (p.allerg.some((x) => a.includes(x))) return false;
  }
  if (p.deteste && p.deteste.length) {
    const d = aversionsOf(r);
    if (p.deteste.some((x) => d.includes(x))) return false;
  }
  return true;
}

/** Compatible avec les réglages du planificateur (on planifie des repas). */
export function plannable(r: Recipe, s: { equip: string[] | null; prefs: DietPrefs; cuisine: string }): boolean {
  if (r.cat !== "Plat" && r.cat !== "Accompagnement") return false;
  const equip = s.equip || [];
  if (equip.length) {
    const b = besoinsRecette(r);
    if (b.some((x) => !equip.includes(x))) return false;
  }
  if (!respectsDiet(r, s.prefs)) return false;
  if (s.cuisine && cuisineDe(r) !== s.cuisine) return false;
  return true;
}
