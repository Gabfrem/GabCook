/* Import d'une recette depuis n'importe quel site de cuisine : Marmiton, 750g, CuisineAZ,
   Journal des Femmes, Ricardo, BBC Good Food… Ces pages publient leur recette au format
   schema.org/Recipe (JSON-LD), qu'on lit plutôt que de gratter le HTML. */
import type { Category, Ingredient } from "./recipe";
import { norm } from "./text";

/** « PT1H30M » -> 90 */
export function isoMinutes(d: unknown): number {
  const m = String(d || "").match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? +(m[1] || 0) * 60 + +(m[2] || 0) : 0;
}
/** L'image peut être une chaîne, un tableau, ou un objet {url}. */
export function imageOf(img: unknown): string {
  let u: any = img;
  if (Array.isArray(u)) u = u[0];
  if (u && typeof u === "object") u = u.url || u.contentUrl || "";
  u = String(u || "");
  return /^https?:\/\//.test(u) ? u : "";
}
/** « 4 personnes » -> 4 */
export function parseYield(y: unknown): number {
  if (Array.isArray(y)) y = y[0];
  const n = parseInt(String(y == null ? "" : y), 10);
  return n > 0 && n <= 50 ? n : 4;
}
export function mapCategory(c: unknown, name = ""): Category {
  const s = norm((Array.isArray(c) ? c[0] : c) + " " + name);
  if (/dessert|gateau|patiss|cake sucre|biscuit|tarte aux (pommes|fraises|poires|citron)|cookie/.test(s)) return "Dessert";
  if (/entree|starter|soupe|veloute/.test(s)) return "Entrée";
  if (/aperi|amuse|tapas|dip/.test(s)) return "Apéro";
  if (/petit dej|breakfast|brunch/.test(s)) return "Petit-déj";
  if (/accompagn|garniture|side/.test(s)) return "Accompagnement";
  return "Plat";
}

const FRAC: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
const UNITS: [RegExp, string][] = [
  [/^(kg|kilos?|kilogrammes?)$/i, "kg"],
  [/^(g|gr|grs|grammes?)$/i, "g"],
  [/^(l|litres?)$/i, "l"],
  [/^(cl|centilitres?)$/i, "cl"],
  [/^(ml|millilitres?)$/i, "ml"],
  [/^(dl|décilitres?)$/i, "dl"],
  [/^(c\.?\s*à\s*s\.?|cs|cas|càs|c\.\s*s\.|cuill?[eè]res?\s*à\s*soupe|cuill?\.?\s*à\s*soupe|tbsp|tablespoons?)$/i, "c. à soupe"],
  [/^(c\.?\s*à\s*c\.?|cc|cac|càc|c\.\s*c\.|cuill?[eè]res?\s*à\s*caf[eé]|cuill?\.?\s*à\s*caf[eé]|tsp|teaspoons?)$/i, "c. à café"],
  [/^pinc[eé]es?$/i, "pincée"],
  [/^poign[eé]es?$/i, "poignée"],
  [/^sachets?$/i, "sachet"]
];
function num(s: string): number | null {
  s = (s || "").trim();
  if (FRAC[s] != null) return FRAC[s];
  const e = s.match(/^(\d+)\s+([½¼¾⅓⅔⅛])$/);
  if (e) return +e[1] + FRAC[e[2]];
  const f = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (f) return +f[1] / +f[2];
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}
/** Coupe les remarques entre parenthèses, même non fermées, et la ponctuation résiduelle. */
const coupeNote = (s: string) =>
  String(s || "")
    .split(/[()]/)[0]
    .replace(/[.,;:]+$/, "")
    .trim();

/** « 200 g de crème fraîche » -> {q:200, u:"g", n:"crème fraîche"} */
export function parseIngredientLine(str: string): Ingredient {
  let s = String(str || "")
    .replace(/\s+/g, " ")
    .replace(/"[^"]*"/g, "")
    .trim();
  const m = s.match(/^(\d+\s*[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|[\d.,]+(?:\s*\/\s*\d+)?)\s*(.*)$/);
  if (!m) return { q: null, u: "", n: coupeNote(s) };
  let q = num(m[1]);
  let reste = m[2].trim();
  let u = "";
  // unité collée (« 200g ») ou séparée (« 2 cuillères à soupe »)
  const mot = reste.match(/^((?:cuill?[eè]res?|cuill?\.?|c\.?)\s*à\s*(?:soupe|caf[eé]|s\.?|c\.?)|\S+)\s*(.*)$/i);
  if (mot) {
    for (const [re, canon] of UNITS) {
      if (re.test(mot[1].replace(/\.$/, ""))) {
        u = canon;
        reste = mot[2];
        break;
      }
    }
  }
  if (u === "dl" && q != null) {
    q *= 10;
    u = "cl";
  }
  reste = reste.replace(/^(de\s+|d['’]\s*|des\s+|du\s+)/i, "").trim();
  return { q, u, n: coupeNote(reste) || coupeNote(s) };
}

/** Aplatit recipeInstructions sous toutes ses formes (texte, HowToStep, HowToSection…). */
export function flattenSteps(inst: unknown): string[] {
  const out: string[] = [];
  (function walk(x: any) {
    if (!x) return;
    if (typeof x === "string") {
      x.replace(/<[^>]+>/g, "\n")
        .split(/\n+/)
        .forEach((l: string) => {
          l = l.replace(/&nbsp;/g, " ").trim();
          if (l) out.push(l);
        });
      return;
    }
    if (Array.isArray(x)) {
      x.forEach(walk);
      return;
    }
    if (x.text) {
      walk(String(x.text));
      return;
    }
    if (x.itemListElement) {
      walk(x.itemListElement);
      return;
    }
    if (x.name && typeof x.name === "string") walk(x.name);
  })(inst);
  return out;
}

/** Trouve l'objet Recipe dans les blocs JSON-LD d'une page HTML. */
export function extractRecipeJsonLd(html: string): Record<string, any> | null {
  const blocs = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const isRecipe = (o: any) => {
    const t = o && o["@type"];
    return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
  };
  for (const b of blocs) {
    const json = b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const d = JSON.parse(json);
      const candidats: any[] = [];
      const visit = (o: any) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) return o.forEach(visit);
        candidats.push(o);
        if (o["@graph"]) visit(o["@graph"]);
        if (o.mainEntity) visit(o.mainEntity);
      };
      visit(d);
      const rec = candidats.find(isRecipe);
      if (rec) return rec;
    } catch {
      /* bloc illisible : suivant */
    }
  }
  return null;
}

export interface ImportedRecipe {
  nom: string;
  photo: string;
  cat: Category;
  portions: number;
  prep: number;
  cuisson: number;
  ing: Ingredient[];
  etapes: string[];
}
export function recipeFromJsonLd(rec: Record<string, any>): ImportedRecipe {
  const ing = (rec.recipeIngredient || rec.ingredients || [])
    .map((x: unknown) => parseIngredientLine(String(x)))
    .filter((i: Ingredient) => i.n);
  const etapes = flattenSteps(rec.recipeInstructions);
  const prep = isoMinutes(rec.prepTime);
  return {
    nom: String(rec.name || "").trim(),
    photo: imageOf(rec.image),
    cat: mapCategory(rec.recipeCategory, rec.name),
    portions: parseYield(rec.recipeYield),
    prep,
    cuisson: isoMinutes(rec.cookTime) || Math.max(0, isoMinutes(rec.totalTime) - prep),
    ing,
    etapes
  };
}
