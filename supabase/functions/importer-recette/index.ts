/* Fonction serveur « importer-recette » (Supabase Edge Functions, Deno).
 *
 * Le navigateur ne peut pas lire une page d'un autre site (règle CORS) : cette fonction
 * va chercher la page de la recette côté serveur et n'en renvoie QUE la recette au
 * format schema.org/Recipe (JSON-LD) que publient Marmiton, 750g, CuisineAZ, Journal
 * des Femmes, Ricardo, BBC Good Food… Elle ne sert donc pas de relais générique.
 *
 * Appel : POST { url } -> { ok: true, recipe, url } | { ok: false, error }
 * Déploiement : supabase functions deploy importer-recette
 */

const ORIGINS = ["https://yummly.fr", "https://www.yummly.fr", "http://localhost:5173", "http://localhost:4173"];
const MAX_BYTES = 4 * 1024 * 1024;

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin"
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" } });
}

/** Refuse les adresses internes (localhost, IP privées) : on ne va chercher que des sites publics. */
function urlPublique(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.startsWith("[") || h.includes(":")) return null; // pas d'IP littérale
  return u;
}

/** Lit au plus MAX_BYTES de la réponse. */
async function lireTexte(r: Response): Promise<string> {
  const reader = r.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  return new TextDecoder("utf-8").decode(all);
}

/** Cherche l'objet Recipe dans les blocs JSON-LD de la page. */
function extraireRecette(html: string): Record<string, unknown> | null {
  const blocs = html.match(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const estRecette = (o: any) => {
    const t = o && o["@type"];
    return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
  };
  for (const b of blocs) {
    const contenu = b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    let d: unknown;
    try {
      d = JSON.parse(contenu);
    } catch {
      try {
        // certains sites laissent des retours à la ligne bruts dans les chaînes
        d = JSON.parse(contenu.replace(/[\u0000-\u001f]+/g, " "));
      } catch {
        continue;
      }
    }
    const candidats: any[] = [];
    const visite = (o: any) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach(visite);
      candidats.push(o);
      if (o["@graph"]) visite(o["@graph"]);
      if (o.mainEntity) visite(o.mainEntity);
    };
    visite(d);
    const r = candidats.find(estRecette);
    if (r) return r;
  }
  return null;
}

/** On ne renvoie que les champs utiles à l'import. */
function champsUtiles(r: Record<string, any>) {
  const pick = ["name", "image", "recipeYield", "prepTime", "cookTime", "totalTime", "recipeIngredient", "ingredients", "recipeInstructions", "recipeCategory", "description"];
  const out: Record<string, unknown> = {};
  for (const k of pick) if (r[k] != null) out[k] = r[k];
  return out;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "methode" }, 405, origin);

  let url: URL | null = null;
  try {
    const body = await req.json();
    url = urlPublique(String(body && body.url ? body.url : "").trim());
  } catch {
    url = null;
  }
  if (!url) return json({ ok: false, error: "adresse" }, 400, origin);

  let reponse: Response;
  try {
    reponse = await fetch(url.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7"
      }
    });
  } catch {
    return json({ ok: false, error: "injoignable" }, 502, origin);
  }
  // une redirection ne doit pas mener vers une adresse interne
  if (!urlPublique(reponse.url || url.toString())) return json({ ok: false, error: "adresse" }, 400, origin);
  if (!reponse.ok) return json({ ok: false, error: "site", status: reponse.status }, 502, origin);
  const type = reponse.headers.get("content-type") || "";
  if (type && !/html|xml|text\/plain/i.test(type)) return json({ ok: false, error: "pas-une-page" }, 422, origin);

  const html = await lireTexte(reponse);
  const recette = extraireRecette(html);
  if (!recette) return json({ ok: false, error: "pas-de-recette" }, 422, origin);
  return json({ ok: true, url: reponse.url || url.toString(), recipe: champsUtiles(recette) }, 200, origin);
});
