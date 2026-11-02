/* ==========================================================================
   SUGGESTIONS D'INGRÉDIENTS
   « onion », « ognon » ou « oigon » : on propose la forme que l'application comprend,
   tirée du vocabulaire réel des recettes.
   ========================================================================== */
import { pantryName } from "./ingredients";
import { FR_EN } from "./tables";
import { cap, norm } from "./text";

export interface VocabEntry {
  nom: string;
  cle: string;
  poids: number;
}

export function buildVocab(names: Iterable<string>): VocabEntry[] {
  const vus = new Map<string, VocabEntry>();
  for (const raw of names) {
    const c = pantryName((raw || "").trim());
    if (!c || c.length < 2) continue;
    const k = norm(c);
    if (!vus.has(k)) vus.set(k, { nom: cap(c), cle: k, poids: 0 });
    vus.get(k)!.poids++;
  }
  return [...vus.values()].sort((a, b) => b.poids - a.poids);
}

let _aliasEN: Record<string, string> | null = null;
/** « onion », « cheese » ne sont pas des fautes mais de l'anglais : glossaire inversé. */
export function aliasEN(): Record<string, string> {
  if (_aliasEN) return _aliasEN;
  const a: Record<string, string> = {};
  Object.entries(FR_EN).forEach(([fr, en]) => {
    String(en)
      .split(" ")
      .forEach((m) => {
        m = norm(m);
        if (m.length > 2 && !a[m]) a[m] = fr;
      });
  });
  Object.entries({
    garlic: "ail", butter: "beurre", flour: "farine", milk: "lait", cream: "creme", sugar: "sucre", salt: "sel",
    oil: "huile", water: "eau", bread: "pain", ham: "jambon", bacon: "lardons", shrimp: "crevettes", prawns: "crevettes",
    honey: "miel", lemon: "citron", apple: "pommes", banana: "bananes", spinach: "epinards", zucchini: "courgettes",
    eggplant: "aubergines", cucumber: "concombre", cabbage: "chou", leek: "poireaux", parsley: "persil", basil: "basilic",
    mint: "menthe", thyme: "thym", ginger: "gingembre", vinegar: "vinaigre", mustard: "moutarde", yogurt: "yaourt",
    noodles: "nouilles", lentils: "lentilles", peas: "petits pois", corn: "mais", tuna: "thon", salmon: "saumon",
    pork: "porc", lamb: "agneau", veal: "veau", turkey: "dinde", duck: "canard"
  }).forEach(([en, fr]) => {
    if (!a[en]) a[en] = fr;
  });
  _aliasEN = a;
  return a;
}

/** Distance de Damerau-Levenshtein bornée (la transposition compte pour 1). */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length,
    m = b.length;
  let av: number[] | null = null,
    prec = [...Array(m + 1).keys()];
  for (let i = 1; i <= n; i++) {
    const cour = new Array<number>(m + 1);
    cour[0] = i;
    let mini = i;
    for (let j = 1; j <= m; j++) {
      let c = Math.min(cour[j - 1] + 1, prec[j] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && av) c = Math.min(c, av[j - 2] + 1);
      cour[j] = c;
      if (c < mini) mini = c;
    }
    if (mini > max) return max + 1;
    av = prec;
    prec = cour;
  }
  return prec[m];
}

/** Propositions classées : préfixe exact, puis contenu, puis proche à la faute de frappe près. */
export function suggest(vocab: VocabEntry[], saisie: string, limite = 6): string[] {
  const brut = (saisie || "").trim();
  const q = norm(brut);
  if (q.length < 2) return [];
  let qc = norm(pantryName(brut));
  const al = aliasEN()[q];
  if (al) qc = norm(pantryName(al));
  const max = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
  const out: { v: VocabEntry; score: number }[] = [];
  vocab.forEach((v) => {
    let score: number | null = null;
    if (v.cle === q || v.cle === qc) score = 0;
    else if (qc && v.cle.startsWith(qc)) score = 0.5;
    else if (v.cle.startsWith(q)) score = 1;
    else if (v.cle.includes(q)) score = 2;
    else {
      const dTout = distance(q, v.cle, max);
      if (dTout <= max) score = 3 + dTout;
      else {
        const dMot = Math.min(...v.cle.split(" ").map((m) => distance(q, m, max)));
        if (dMot <= max) score = 3.5 + dMot;
      }
    }
    if (score != null) out.push({ v, score });
  });
  out.sort((a, b) => a.score - b.score || b.v.poids - a.v.poids || a.v.nom.length - b.v.nom.length);
  return out.slice(0, limite).map((x) => x.v.nom);
}
