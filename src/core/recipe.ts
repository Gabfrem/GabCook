import { clean } from "./text";

export const CATEGORIES = ["Plat", "Entrée", "Accompagnement", "Dessert", "Apéro", "Petit-déj"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Difficulty = "Facile" | "Moyen" | "Difficile";

export interface Ingredient {
  q: number | null;
  u: string;
  n: string;
}

export interface Recipe {
  id: string;
  nom: string;
  emoji: string;
  cat: Category | string;
  prep: number;
  cuisson: number;
  portions: number;
  diff: Difficulty | string;
  ing: Ingredient[];
  etapes: string[];
  /** photo du plat (URL) */
  photo?: string;
  /** crédit de la photo, affiché discrètement */
  photoCredit?: string;
  /** la photo montre un plat ressemblant (pas exactement celui-ci) */
  photoProche?: boolean;
  /** recette personnelle (créée, importée ou reçue) */
  perso?: boolean;
  /** pseudo de l'auteur si la recette vient d'un autre profil */
  credit?: string;
  /** « marmiton », « web »… pour les imports ; vide = créée de toutes pièces */
  src?: string;
  /** adresse de la page d'origine pour un import web */
  srcUrl?: string;
  /** aperçu d'une recette d'un autre profil, pas encore ajoutée */
  _preview?: boolean;
  /** recette ajoutée récemment au catalogue (étagère « Nouveautés ») */
  nouveau?: boolean;
}

export const totalTime = (r: Pick<Recipe, "prep" | "cuisson">, cuisson?: number) =>
  (r.prep || 0) + (cuisson ?? r.cuisson ?? 0);

/** Remet une recette venue du stockage, d'un lien ou d'un import dans un état sûr et complet. */
export function sanitizeRecipe(x: unknown): Recipe | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, any>;
  const nom = clean(o.nom);
  const ing: Ingredient[] = Array.isArray(o.ing)
    ? o.ing
        .map((i: any) => ({
          q: i && i.q != null && i.q !== "" && isFinite(+i.q) ? +i.q : null,
          u: clean(i && i.u),
          n: clean(i && i.n)
        }))
        .filter((i: Ingredient) => i.n)
    : [];
  const etapes: string[] = Array.isArray(o.etapes) ? o.etapes.map(clean).filter(Boolean) : [];
  if (!nom || !ing.length || !etapes.length) return null;
  const num = (v: unknown, min: number, max: number, def: number) => {
    const n = parseInt(String(v), 10);
    return isNaN(n) ? def : Math.min(max, Math.max(min, n));
  };
  const photo = typeof o.photo === "string" && /^(https?:|data:image\/)/.test(o.photo) ? o.photo : "";
  return {
    id: clean(o.id) || "perso-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nom,
    emoji: clean(o.emoji) || "🍽️",
    cat: clean(o.cat) || "Plat",
    diff: clean(o.diff) || "Facile",
    prep: num(o.prep, 0, 999, 0),
    cuisson: num(o.cuisson, 0, 999, 0),
    portions: num(o.portions, 1, 50, 4),
    ing,
    etapes,
    photo,
    perso: true,
    credit: clean(o.credit) || "",
    src: clean(o.src) || "",
    // seules les adresses web sont gardées : jamais de « javascript: » dans un lien
    srcUrl: typeof o.srcUrl === "string" && /^https?:\/\/[^\s"'<>]+$/i.test(o.srcUrl) ? o.srcUrl : ""
  };
}

/** Une recette n'est proposée sur mon profil que si je l'ai créée de toutes pièces. */
export const isOriginalRecipe = (r: Recipe | null | undefined): boolean => !!(r && r.perso && !r.credit && !r.src);

/** Forme « propre » stockée dans la table publique `recipes`. */
export function recipeData(r: Recipe) {
  return {
    nom: r.nom,
    emoji: r.emoji,
    cat: r.cat,
    diff: r.diff,
    prep: r.prep,
    cuisson: r.cuisson,
    portions: r.portions,
    ing: r.ing,
    etapes: r.etapes,
    photo: r.photo || ""
  };
}

/* ---------- MODES AIR FRYER / MICRO-ONDES ----------
   four:1 -> la version d'origine exige un four ; four:0 -> faisable sans four, version air fryer en bonus
   ko -> non adaptable (raison affichée) ; t -> °C ; min -> minutes ; s -> étapes réécrites par index */
export interface AirFryerInfo {
  four?: number;
  t?: number;
  min?: number;
  tip?: string;
  ko?: string;
  s?: Record<string, string>;
}
export interface MicrowaveInfo {
  ok?: number;
  w?: string;
  min?: number;
  tip?: string;
  s?: Record<string, string>;
}

export interface RecipeView {
  cuisson: number;
  etapes: string[];
  af: AirFryerInfo | null;
  mo: MicrowaveInfo | null;
}

export type CookMode = "normal" | "airfryer" | "micro";

export function viewOf(
  r: Recipe,
  mode: CookMode,
  AF: Record<string, AirFryerInfo>,
  MO: Record<string, MicrowaveInfo>
): RecipeView {
  const brut: RecipeView = { cuisson: r.cuisson, etapes: r.etapes, af: null, mo: null };
  if (mode === "micro") {
    const m = MO[r.id];
    if (!m || m.ok) return brut;
    return {
      cuisson: m.min != null ? m.min : r.cuisson,
      etapes: m.s ? r.etapes.map((e, i) => (m.s![i] != null ? m.s![i] : e)) : r.etapes,
      af: null,
      mo: m
    };
  }
  if (mode !== "airfryer") return brut;
  const a = AF[r.id];
  if (!a || a.ko) return brut;
  return {
    cuisson: a.min != null ? a.min : r.cuisson,
    etapes: a.s ? r.etapes.map((e, i) => (a.s![i] != null ? a.s![i] : e)) : r.etapes,
    af: a,
    mo: null
  };
}
export const needsOven = (r: Recipe, AF: Record<string, AirFryerInfo>) => !!(AF[r.id] && AF[r.id].four);
/** réalisable sans four (n'en a jamais eu besoin, ou une version air fryer existe) */
export const airFryerOk = (r: Recipe, AF: Record<string, AirFryerInfo>) => !AF[r.id] || !AF[r.id].ko;
export const microOk = (r: Recipe, MO: Record<string, MicrowaveInfo>) => !!MO[r.id];
