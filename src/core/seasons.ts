/* Calendrier des fruits et légumes de saison en France métropolitaine.
   Une recette est « de saison » si elle met en avant au moins un produit de saison
   et n'en contient aucun franchement hors saison (tomates en janvier…). */
import type { Recipe } from "./recipe";
import { norm } from "./text";

/** [motif, mois de saison (1-12)] */
const SAISONS: [RegExp, number[]][] = [
  [/asperges?/, [4, 5, 6]],
  [/aubergines?/, [6, 7, 8, 9]],
  [/brocolis?/, [6, 7, 8, 9, 10, 11]],
  [/butternut|potiron|courges?|potimarron|citrouille/, [9, 10, 11, 12, 1, 2]],
  [/celeri/, [9, 10, 11, 12, 1, 2, 3]],
  [/champignons?|cepes|girolles/, [9, 10, 11]],
  [/chou-fleur|chou fleur|choux? de bruxelles|chou/, [10, 11, 12, 1, 2, 3]],
  [/concombres?/, [5, 6, 7, 8, 9]],
  [/courgettes?/, [6, 7, 8, 9]],
  [/endives?/, [10, 11, 12, 1, 2, 3, 4]],
  [/epinards?/, [3, 4, 5, 9, 10, 11]],
  [/fenouil/, [6, 7, 8, 9, 10]],
  [/haricots? verts?/, [6, 7, 8, 9]],
  [/mache/, [10, 11, 12, 1, 2, 3]],
  [/mais/, [8, 9]],
  [/navets?|panais|topinambours?/, [10, 11, 12, 1, 2, 3]],
  [/petits pois|feves/, [5, 6, 7]],
  [/poireaux?/, [9, 10, 11, 12, 1, 2, 3, 4]],
  [/poivrons?/, [7, 8, 9]],
  [/radis/, [4, 5, 6, 7]],
  [/tomates?(?! (concassees|pelees|sechees))/, [6, 7, 8, 9]],
  [/artichauts?/, [5, 6, 7, 8, 9]],
  [/abricots?/, [6, 7, 8]],
  [/cerises?/, [5, 6, 7]],
  [/fraises?/, [4, 5, 6, 7]],
  [/framboises?|fruits rouges/, [6, 7, 8, 9]],
  [/melons?|pasteques?/, [6, 7, 8, 9]],
  [/peches?|nectarines?/, [6, 7, 8, 9]],
  [/prunes?|mirabelles?|quetsches?/, [7, 8, 9]],
  [/figues?/, [8, 9, 10]],
  [/raisins?(?! secs?)/, [8, 9, 10]],
  [/myrtilles?/, [7, 8, 9]],
  [/poires?/, [8, 9, 10, 11, 12, 1]],
  [/pommes?(?! de terre)/, [8, 9, 10, 11, 12, 1, 2, 3]],
  [/clementines?|mandarines?/, [11, 12, 1, 2]],
  [/oranges?/, [12, 1, 2, 3]],
  [/kiwis?/, [11, 12, 1, 2, 3, 4]],
  [/chataignes?|marrons?(?! glaces)/, [10, 11, 12]],
  [/rhubarbe/, [4, 5, 6]]
];

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const nomMois = (m: number) => MOIS[(m - 1 + 12) % 12];

export interface SeasonInfo {
  /** produits de saison utilisés */
  dedans: string[];
  /** produits frais hors saison */
  dehors: string[];
}
const _memo = new Map<string, SeasonInfo>();
export function seasonOf(r: Recipe, mois = new Date().getMonth() + 1): SeasonInfo {
  const key = r.id + "|" + mois;
  const hit = _memo.get(key);
  if (hit) return hit;
  const dedans: string[] = [],
    dehors: string[] = [];
  for (const i of r.ing) {
    const n = norm(i.n);
    for (const [re, mm] of SAISONS) {
      if (new RegExp("(^|\\s)(?:" + re.source + ")(?=$|\\s)").test(n)) {
        (mm.includes(mois) ? dedans : dehors).push(i.n);
        break;
      }
    }
  }
  const res = { dedans, dehors };
  _memo.set(key, res);
  return res;
}
export const isDeSaison = (r: Recipe, mois?: number) => {
  const s = seasonOf(r, mois);
  return s.dedans.length > 0 && s.dehors.length === 0;
};
/** Produits de saison du mois, pour l'accueil. */
export function produitsDuMois(mois = new Date().getMonth() + 1): string[] {
  const noms: Record<string, string> = {
    "asperges?": "asperges", "aubergines?": "aubergines", "brocolis?": "brocolis", "butternut|potiron|courges?|potimarron|citrouille": "courges",
    celeri: "céleri", "champignons?|cepes|girolles": "champignons", "chou-fleur|chou fleur|choux? de bruxelles|chou": "choux",
    "concombres?": "concombres", "courgettes?": "courgettes", "endives?": "endives", "epinards?": "épinards", fenouil: "fenouil",
    "haricots? verts?": "haricots verts", mache: "mâche", mais: "maïs", "navets?|panais|topinambours?": "navets & panais",
    "petits pois|feves": "petits pois", "poireaux?": "poireaux", "poivrons?": "poivrons", radis: "radis",
    "tomates?(?! (concassees|pelees|sechees))": "tomates", "artichauts?": "artichauts", "abricots?": "abricots", "cerises?": "cerises",
    "fraises?": "fraises", "framboises?|fruits rouges": "framboises", "melons?|pasteques?": "melons", "peches?|nectarines?": "pêches",
    "prunes?|mirabelles?|quetsches?": "prunes", "figues?": "figues", "raisins?(?! secs?)": "raisin", "myrtilles?": "myrtilles",
    "poires?": "poires", "pommes?(?! de terre)": "pommes", "clementines?|mandarines?": "clémentines", "oranges?": "oranges",
    "kiwis?": "kiwis", "chataignes?|marrons?(?! glaces)": "châtaignes", rhubarbe: "rhubarbe"
  };
  return SAISONS.filter(([, mm]) => mm.includes(mois)).map(([re]) => noms[re.source] || re.source);
}
