/* Import d'une recette depuis une adresse web.
   Le navigateur interdit de lire directement une page d'un autre domaine. On demande
   d'abord à notre fonction serveur Supabase « importer-recette » (fiable, voir
   supabase/functions/importer-recette) ; si elle échoue, on tente des relais publics
   (CORS), gratuits mais souvent en panne. */
import { extractRecipeJsonLd, recipeFromJsonLd, type ImportedRecipe } from "../core/jsonld";
import { sb } from "./supabase";

const RELAIS: { f: (u: string) => string; json?: boolean }[] = [
  { f: (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u) },
  { f: (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u) },
  { f: (u) => "https://api.allorigins.win/get?url=" + encodeURIComponent(u), json: true },
  { f: (u) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u) }
];

async function fetchViaRelais(url: string): Promise<string | null> {
  for (const relais of RELAIS) {
    try {
      const r = await fetch(relais.f(url), { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined });
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

type ResultatFonction = { ok: true; recipe: Record<string, any>; url: string } | { ok: false; error: string; status?: number };

/** Appelle la fonction serveur ; null si elle est injoignable (hors ligne, pas de Supabase). */
async function viaFonction(url: string): Promise<ResultatFonction | null> {
  if (!sb) return null;
  try {
    const { data, error } = await sb.functions.invoke("importer-recette", { body: { url } });
    if (data && data.ok && data.recipe) return { ok: true, recipe: data.recipe, url: data.url || url };
    let code = "erreur",
      status: number | undefined;
    const ctx = error && (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        if (j && j.error) code = j.error;
        if (j && j.status) status = j.status;
      } catch {
        /* ignore */
      }
    }
    return { ok: false, error: code, status };
  } catch {
    return null;
  }
}

export function normalizeUrl(raw: string): string | null {
  let url = (raw || "").trim().replace(/\s+/g, "");
  const m = url.match(/https?:\/\/[^\s]+/);
  if (m) url = m[0];
  if (!/^https?:\/\//i.test(url) && /^[\w-]+(\.[\w-]+)+\//.test(url)) url = "https://" + url;
  url = url.replace(/^http:/i, "https:").replace(/^https:\/\/m\.marmiton/i, "https://www.marmiton");
  try {
    const u = new URL(url);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid", "gclid"].forEach((k) => u.searchParams.delete(k));
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

const MESSAGES: Record<string, string> = {
  adresse: "Cette adresse n'est pas valide : colle le lien complet de la recette (https://…).",
  site: "Le site a refusé de donner la page pour le moment. Réessaie dans un instant.",
  injoignable: "Le site ne répond pas pour le moment. Réessaie dans un instant.",
  "pas-une-page": "Ce lien ne mène pas à une page de recette.",
  "pas-de-recette": "Aucune recette lisible sur cette page. Vérifie que le lien pointe vers une recette (et pas une liste de résultats)."
};

export async function importFromUrl(raw: string): Promise<{ ok: true; recipe: ImportedRecipe; url: string } | { ok: false; error: string }> {
  const url = normalizeUrl(raw);
  if (!url) return { ok: false, error: MESSAGES.adresse };
  const f = await viaFonction(url);
  if (f && f.ok) {
    const recipe = recipeFromJsonLd(f.recipe);
    if (recipe.nom) return { ok: true, recipe, url: f.url };
  }
  if (f && !f.ok && f.error === "adresse") return { ok: false, error: MESSAGES.adresse };
  // secours : relais publics (le site peut bloquer les serveurs mais pas ces relais)
  const html = await fetchViaRelais(url);
  if (html) {
    const rec = extractRecipeJsonLd(html);
    if (rec && rec.name) return { ok: true, recipe: recipeFromJsonLd(rec), url };
    return { ok: false, error: MESSAGES["pas-de-recette"] };
  }
  return { ok: false, error: (f && !f.ok && MESSAGES[f.error]) || "Impossible de récupérer la page pour le moment. Vérifie ta connexion et réessaie." };
}
