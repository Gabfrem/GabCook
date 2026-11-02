/* Scanner : code-barres -> Open Food Facts -> article générique + quantité. */
import { pantryName } from "./ingredients";
import { trouve } from "./pricing";
import { OFF_CAT, POIDS_PIECE } from "./tables";
import { norm } from "./text";
import { toBase, unitFamily } from "./units";

/** Clé de contrôle EAN/UPC : une lecture optique bancale échoue presque toujours ce test. */
export function codeBarreValide(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
  const d = code.split("").map(Number),
    cle = d.pop()!;
  let somme = 0;
  d.reverse().forEach((n, i) => {
    somme += n * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (somme % 10)) % 10 === cle;
}

/** « 6 x 125 g », « 500 g », « 6 pièces »… -> {q,u} */
export function quantiteOFF(txt: string | undefined): { q: number | null; u: string } {
  const t = (txt || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return { q: null, u: "" };
  const mult = t.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|cl|ml|dl)\b/);
  if (mult) return norme(parseFloat(mult[1]) * parseFloat(mult[2].replace(",", ".")), mult[3]);
  const pcs = t.match(/(\d+)\s*(?:pi[èe]ces?|unit[ée]s?|fruits?|l[ée]gumes?|oeufs?|œufs?)\b/) || t.match(/^[x×]\s*(\d+)$/) || t.match(/\b[x×]\s*(\d+)\b/);
  if (pcs) return { q: parseFloat(pcs[1]), u: "" };
  const un = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|cl|ml|dl)\b/);
  if (un) return norme(parseFloat(un[1].replace(",", ".")), un[2]);
  const seul = t.match(/^(\d+)$/);
  if (seul) return { q: parseFloat(seul[1]), u: "" };
  return { q: null, u: "" };
}
function norme(q: number, u: string) {
  if (u === "dl") return { q: q * 10, u: "cl" };
  if (u === "mg") return { q: q / 1000, u: "g" };
  return { q, u };
}

/** Un filet de poivrons pesé en grammes : on préfère compter les poivrons. */
export function versPieces(nom: string, q: number | null, u: string): { q: number | null; u: string } {
  if (q == null || !u || unitFamily(u) !== "masse") return { q, u };
  const e = trouve(POIDS_PIECE, norm(nom));
  if (!e) return { q, u };
  const kg = toBase(q, u) / 1000;
  const n = Math.round(kg / e[1]);
  if (n >= 1 && n <= 30) return { q: n, u: "" };
  return { q, u };
}

export interface OffProduct {
  product_name?: string;
  product_name_fr?: string;
  quantity?: string;
  product_quantity?: string | number;
  categories_tags?: string[];
  brands?: string;
}

/** Nom générique d'un produit scanné : catégories d'abord, nom commercial ensuite. */
export function nomGenerique(prod: OffProduct): string {
  const cats = (prod.categories_tags || []).join(" ");
  for (const [re, nom] of OFF_CAT) if (re.test(cats)) return nom;
  const brut = (prod.product_name_fr || prod.product_name || "").trim();
  if (!brut) return "";
  const marques = (prod.brands || "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  let net = brut;
  marques.forEach((m) => {
    net = net.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  });
  net = net
    .replace(/\d+\s*(kg|g|l|cl|ml|dl)\b/gi, " ")
    .replace(/\b(bio|extra|premium|light|nature|allege|allégé|saveur|go[ûu]t|format|familial|le|la|les|nos|notre|du|de|des|au|aux)\b/gi, " ")
    .replace(/[^\p{L}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const vus = new Set<string>(),
    mots: string[] = [];
  net.split(" ").forEach((m) => {
    const k = norm(m);
    if (k.length > 1 && !vus.has(k)) {
      vus.add(k);
      mots.push(m);
    }
  });
  net = mots
    .slice(0, 3)
    .join(" ")
    .replace(/(^|\s)(et|avec|sans|pour|en)(\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!net)
    net = brut
      .replace(/[^\p{L}\s-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 2)
      .join(" ");
  if (!net) return "";
  return pantryName(net);
}

/** Produit Open Food Facts -> {nom, q, u} prêt à ranger. */
export function produitVersArticle(prod: OffProduct): { nom: string; q: number | null; u: string; brut: string } | null {
  const brut = (prod.product_name_fr || prod.product_name || "").trim();
  const nom =
    nomGenerique(prod) ||
    pantryName(
      brut
        .replace(/[^\p{L}\s-]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .slice(0, 3)
        .join(" ")
    );
  if (!nom) return null;
  const qt = quantiteOFF(prod.quantity);
  let q = qt.q,
    u = qt.u;
  if (q == null && prod.product_quantity) {
    const n = parseFloat(String(prod.product_quantity));
    if (!isNaN(n)) {
      q = n;
      u = "g";
    }
  }
  const pc = versPieces(nom, q, u);
  return { nom, q: pc.q, u: pc.u, brut };
}
