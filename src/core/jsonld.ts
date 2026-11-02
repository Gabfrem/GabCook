/* Import d'une recette depuis n'importe quel site de cuisine : Marmiton, 750g, CuisineAZ,
   Journal des Femmes, Ricardo, BBC Good Food… Ces pages publient leur recette au format
   schema.org/Recipe (JSON-LD), qu'on lit plutôt que de gratter le HTML. */
import type { Category, Ingredient } from "./recipe";
import { norm } from "./text";

/** Durée ISO 8601 en minutes : « PT1H30M » -> 90, « P0DT0H20M » -> 20, « 25 » -> 25. */
export function isoMinutes(d: unknown): number {
  const s = String(d == null ? "" : d).trim().toUpperCase();
  if (!s) return 0;
  if (!s.startsWith("P")) {
    const n = parseInt(s, 10);
    return n > 0 ? n : 0;
  }
  const [jours, temps = ""] = s.slice(1).split("T");
  // certains sites oublient le « T » (« P20M ») : on lit alors heures et minutes quand même
  const t = temps || jours.replace(/\d+D/, "");
  const lire = (src: string, k: string) => +((src.match(new RegExp("(\\d+(?:[.,]\\d+)?)" + k)) || [])[1] || "0").replace(",", ".");
  return Math.round(lire(jours, "D") * 1440 + lire(t, "H") * 60 + lire(t, "M"));
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
  if (Array.isArray(y)) y = y.find((v) => /\d/.test(String(v))) ?? y[0];
  const m = String(y == null ? "" : y).match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
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
/** [mot lu, unité de l'appli, facteur] — les mesures anglo-saxonnes sont converties. */
const UNITS: [RegExp, string, number][] = [
  [/^(kg|kilos?|kilogrammes?)$/i, "kg", 1],
  [/^(g|gr|grs|grammes?)$/i, "g", 1],
  [/^(mg|milligrammes?)$/i, "g", 0.001],
  [/^(l|litres?)$/i, "l", 1],
  [/^(cl|centilitres?)$/i, "cl", 1],
  [/^(ml|millilitres?)$/i, "ml", 1],
  [/^(dl|décilitres?)$/i, "cl", 10],
  [/^(c\.?\s*à\.?\s*(s\.?|soupe)|cs|cas|càs|c\.\s*s\.?|cuill?[eè]res?\s*à\s*soupe|cuill?\.?\s*à\s*soupe|tbsps?|tbs|tablespoons?)$/i, "c. à soupe", 1],
  [/^(c\.?\s*à\.?\s*(c\.?|caf[eé]|th[eé])|cc|cac|càc|c\.\s*c\.?|cuill?[eè]res?\s*à\s*(caf[eé]|th[eé])|cuill?\.?\s*à\s*(caf[eé]|th[eé])|tsps?|teaspoons?)$/i, "c. à café", 1],
  [/^pinc[eé]es?$/i, "pincée", 1],
  [/^poign[eé]es?$/i, "poignée", 1],
  [/^sachets?$/i, "sachet", 1],
  [/^(tasses?|cups?)$/i, "ml", 250],
  [/^(oz|onces?)$/i, "g", 28.35],
  [/^(lbs?)$/i, "g", 453.6],
  [/^livres?$/i, "g", 500]
];
const NOMBRE = String.raw`\d+\s+\d+\s*\/\s*\d+|\d+\s*[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?`;
function num(s: string): number | null {
  s = (s || "").trim();
  if (FRAC[s] != null) return FRAC[s];
  const mixte = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixte) return +mixte[1] + +mixte[2] / +mixte[3];
  const e = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/);
  if (e) return +e[1] + FRAC[e[2]];
  const f = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (f) return +f[2] ? +f[1] / +f[2] : null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}
/** Coupe les remarques entre parenthèses, même non fermées, et la ponctuation résiduelle. */
const coupeNote = (s: string) =>
  String(s || "")
    .split(/[()]/)[0]
    .replace(/[.,;:]+$/, "")
    .trim();
const sansArticle = (s: string) => s.replace(/^(de la\s+|de l['’]\s*|de\s+|d['’]\s*|des\s+|du\s+)/i, "").trim();
/** « oignon, haché finement » -> « oignon » : la préparation n'est pas un ingrédient à acheter. */
const PREPA = /,\s*(?:(?:très|bien|finement|grossièrement|légèrement)\s+)?(?:hach|éminc|coup|râp|pel|éplu|écras|cisel|égoutt|rinc|tranch|fond|ramoll|batt|pressé|dénoyaut|épépin|émiett|en (?:dés|cubes|morceaux|rondelles|lamelles|tranches|julienne|quartiers|purée)|à température|facultati|au goût|pour (?:la|le|les|servir|décor))/i;

/** « 200 g de crème fraîche » -> {q:200, u:"g", n:"crème fraîche"} ;
 *  « 250 ml (1 tasse) de farine » -> {q:250, u:"ml", n:"farine"} ;
 *  « 1 boîte de 400 g de pois chiches » -> {q:400, u:"g", n:"pois chiches"}. */
export function parseIngredientLine(str: string): Ingredient {
  const brut = String(str || "")
    .replace(/\s+/g, " ")
    .replace(/"[^"]*"/g, "")
    .trim();
  // les équivalences entre parenthèses (« (1 tasse) », « (14 oz) ») gênent la lecture
  const s = brut.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const m = s.match(new RegExp("^(" + NOMBRE + ")(?:\\s*(?:-|à|ou)\\s*(?:" + NOMBRE + "))?\\s*(.*)$"));
  if (!m) return { q: null, u: "", n: nettoieNom(s) || coupeNote(brut) };
  let q = num(m[1]);
  let reste = m[2].trim();
  let u = "";
  // contenant + contenance : « 1 boîte de 400 g de… » -> 400 g
  const cont = reste.match(/^(?:bo[iî]tes?|conserves?|cans?|pots?|bocal|bocaux|briques?|paquets?|barquettes?)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b\s*(.*)$/i);
  if (cont && q != null) {
    q = q * parseFloat(cont[1].replace(",", "."));
    u = cont[2].toLowerCase();
    reste = cont[3];
  } else {
    // unité collée (« 200g ») ou séparée (« 2 cuillères à soupe »)
    const mot = reste.match(/^((?:cuill?[eè]res?|cuill?\.?|c\.?)\s*à\.?\s*(?:soupe|caf[eé]|th[eé]|s\.?|c\.?)|\S+)\s*(.*)$/i);
    if (mot) {
      for (const [re, canon, facteur] of UNITS) {
        if (re.test(mot[1].replace(/\.$/, ""))) {
          u = canon;
          if (q != null) q = Math.round(q * facteur * 100) / 100;
          reste = mot[2];
          break;
        }
      }
    }
  }
  return { q, u, n: nettoieNom(reste) || coupeNote(s) };
}
function nettoieNom(s: string): string {
  let n = sansArticle(s.trim());
  const k = n.search(PREPA);
  if (k > 0) n = n.slice(0, k);
  return coupeNote(n);
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
  // même lecture que la fonction serveur importer-recette : attribut type avec ou sans guillemets
  const blocs = html.match(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const isRecipe = (o: any) => {
    const t = o && o["@type"];
    return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
  };
  for (const b of blocs) {
    const json = b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    let d: unknown;
    try {
      d = JSON.parse(json);
    } catch {
      try {
        // certains sites laissent des retours à la ligne bruts dans les chaînes
        d = JSON.parse(json.replace(/[\u0000-\u001f]+/g, " "));
      } catch {
        continue;
      }
    }
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
