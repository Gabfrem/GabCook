/* Format texte des recettes de Yummly (data/recettes/*.txt).
 *
 *   === Pâtes à la carbonara
 *   id: carbonara
 *   emoji: 🍝
 *   categorie: Plat
 *   preparation: 10
 *   cuisson: 15
 *   portions: 4
 *   difficulte: Facile
 *   photo: https://…            (facultatif)
 *   nouveau: oui                 (facultatif : met la recette en avant dans « Nouveautés »)
 *   ingredients:
 *   - spaghetti : 400 g
 *   - œufs : 4
 *   - sel                        (sans quantité)
 *   etapes:
 *   1. Portez l'eau à ébullition…
 *   2. …
 *
 * Une ligne qui commence par # est un commentaire.
 */
export const UNITES = ["g", "kg", "ml", "cl", "l", "c. à soupe", "c. à café", "pincée", "poignée", "sachet", "pot", "pots"];
export const CATEGORIES = ["Plat", "Entrée", "Accompagnement", "Dessert", "Apéro", "Petit-déj"];
export const DIFFICULTES = ["Facile", "Moyen", "Difficile"];

const fmtQ = (q) => String(Math.round(q * 1000) / 1000);

export function serialize(r) {
  const L = [];
  L.push("=== " + r.nom);
  L.push("id: " + r.id);
  L.push("emoji: " + r.emoji);
  L.push("categorie: " + r.cat);
  L.push("preparation: " + r.prep);
  L.push("cuisson: " + r.cuisson);
  L.push("portions: " + r.portions);
  L.push("difficulte: " + r.diff);
  if (r.photo) L.push("photo: " + r.photo);
  if (r.nouveau) L.push("nouveau: oui");
  L.push("ingredients:");
  for (const i of r.ing) {
    if (i.q == null) L.push("- " + i.n + (i.u ? " : " + i.u : ""));
    else L.push("- " + i.n + " : " + fmtQ(i.q) + (i.u ? " " + i.u : ""));
  }
  L.push("etapes:");
  r.etapes.forEach((e, k) => L.push(k + 1 + ". " + e));
  return L.join("\n");
}

function parseQte(txt, where) {
  const t = txt.trim();
  const m = t.match(/^(\d+(?:[.,]\d+)?)(?:\s+(.+))?$/);
  if (!m) {
    // quantité sans nombre : « au goût » n'existe pas ; on accepte une unité seule (« pincée »)
    if (UNITES.includes(t)) return { q: null, u: t };
    throw new Error(where + " : quantité illisible « " + t + " »");
  }
  const q = parseFloat(m[1].replace(",", "."));
  const u = (m[2] || "").trim();
  if (u && !UNITES.includes(u)) throw new Error(where + " : unité inconnue « " + u + " » (unités : " + UNITES.join(", ") + ")");
  return { q, u };
}

export function parse(text, fichier = "?") {
  const out = [];
  let cur = null, mode = null, ligne = 0;
  const fin = () => {
    if (!cur) return;
    const where = fichier + " / « " + cur.nom + " »";
    for (const k of ["id", "emoji", "cat", "diff"]) if (!cur[k]) throw new Error(where + " : champ « " + k + " » manquant");
    if (!CATEGORIES.includes(cur.cat)) throw new Error(where + " : catégorie inconnue « " + cur.cat + " »");
    if (!DIFFICULTES.includes(cur.diff)) throw new Error(where + " : difficulté inconnue « " + cur.diff + " »");
    if (!cur.ing.length) throw new Error(where + " : aucun ingrédient");
    if (!cur.etapes.length) throw new Error(where + " : aucune étape");
    out.push(cur);
    cur = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    ligne++;
    const l = raw.trim();
    if (!l || l.startsWith("#")) continue;
    if (l.startsWith("=== ")) {
      fin();
      cur = { id: "", nom: l.slice(4).trim(), emoji: "", cat: "", prep: 0, cuisson: 0, portions: 4, diff: "", ing: [], etapes: [] };
      mode = null;
      continue;
    }
    if (!cur) throw new Error(fichier + ":" + ligne + " : texte hors recette");
    const where = fichier + ":" + ligne;
    if (l === "ingredients:") { mode = "ing"; continue; }
    if (l === "etapes:") { mode = "etapes"; continue; }
    if (mode === "ing" && l.startsWith("- ")) {
      const s = l.slice(2);
      const k = s.lastIndexOf(" : ");
      if (k < 0) cur.ing.push({ q: null, u: "", n: s.trim() });
      else cur.ing.push({ n: s.slice(0, k).trim(), ...parseQte(s.slice(k + 3), where) });
      continue;
    }
    if (mode === "etapes") {
      const m = l.match(/^(?:\d+\.|-)\s+(.*)$/);
      if (!m) throw new Error(where + " : une étape commence par « 1. » ou « - »");
      cur.etapes.push(m[1].trim());
      continue;
    }
    const m = l.match(/^([a-z_]+)\s*:\s*(.*)$/);
    if (!m) throw new Error(where + " : ligne illisible « " + l + " »");
    const [, cle, val] = m;
    switch (cle) {
      case "id": cur.id = val; break;
      case "emoji": cur.emoji = val; break;
      case "categorie": cur.cat = val; break;
      case "preparation": cur.prep = parseInt(val, 10) || 0; break;
      case "cuisson": cur.cuisson = parseInt(val, 10) || 0; break;
      case "portions": cur.portions = parseInt(val, 10) || 4; break;
      case "difficulte": cur.diff = val; break;
      case "photo": cur.photo = val; break;
      case "nouveau": cur.nouveau = /^(oui|1|true)$/i.test(val); break;
      default: throw new Error(where + " : champ inconnu « " + cle + " »");
    }
  }
  fin();
  return out;
}
