/* Import d'une recette depuis une adresse web.
   Yummly est un site statique : le navigateur interdit de lire directement une page
   d'un autre domaine. On passe par des relais publics (CORS) essayés dans l'ordre ;
   ils tombent parfois en panne, d'où la liste et les délais courts. */
import { extractRecipeJsonLd, recipeFromJsonLd, type ImportedRecipe } from "../core/jsonld";

const RELAIS: { f: (u: string) => string; json?: boolean }[] = [
  { f: (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u) },
  { f: (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u) },
  { f: (u) => "https://proxy.cors.sh/" + u },
  { f: (u) => "https://api.allorigins.win/get?url=" + encodeURIComponent(u), json: true },
  { f: (u) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u) }
];

async function fetchViaRelais(url: string): Promise<string | null> {
  for (const relais of RELAIS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 15000);
      const r = await fetch(relais.f(url), { signal: c.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      let txt = await r.text();
      if (relais.json) {
        try {
          txt = JSON.parse(txt).contents;
        } catch {
          /* ignore */
        }
      }
      if (txt && txt.length > 1500) return txt;
    } catch {
      /* relais suivant */
    }
  }
  return null;
}

export function normalizeUrl(raw: string): string | null {
  let url = (raw || "").trim().replace(/\s+/g, "");
  const m = url.match(/https?:\/\/[^\s]+/);
  if (m) url = m[0];
  if (!/^https?:\/\//i.test(url) && /^[\w-]+(\.[\w-]+)+\//.test(url)) url = "https://" + url;
  url = url.replace(/^http:/i, "https:").replace(/^https:\/\/m\.marmiton/i, "https://www.marmiton");
  try {
    const u = new URL(url);
    // paramètres de suivi inutiles
    ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid"].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return null;
  }
}

export async function importFromUrl(raw: string): Promise<{ ok: true; recipe: ImportedRecipe; url: string } | { ok: false; error: string }> {
  const url = normalizeUrl(raw);
  if (!url) return { ok: false, error: "Colle l'adresse complète de la recette (https://…)." };
  const html = await fetchViaRelais(url);
  if (!html) return { ok: false, error: "Impossible de récupérer la page pour le moment. Réessaie dans un instant." };
  const rec = extractRecipeJsonLd(html);
  if (!rec || !rec.name) return { ok: false, error: "Aucune recette lisible sur cette page. Vérifie que le lien pointe vers une recette (et pas une liste)." };
  const recipe = recipeFromJsonLd(rec);
  return { ok: true, recipe, url };
}
