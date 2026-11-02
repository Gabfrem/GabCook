/* Démarrage : catalogue, session, liens reçus, mise à jour hors ligne. */
import { batch } from "@preact/signals";
import { decodeRecipe, decodeSync } from "../core/links";
import type { AirFryerInfo, MicrowaveInfo, Recipe } from "../core/recipe";
import { initAuth } from "../services/auth";
import { AF, catalog, catalogReady, findRecipe, localGet, MO, user } from "../state/store";
import { openOverlay, openSheet, pushBuffer } from "../state/ui";

async function loadCatalog() {
  const [c, a, m] = await Promise.all([import("../data/catalog.json"), import("../data/airfryer.json"), import("../data/microondes.json")]);
  batch(() => {
    catalog.value = (c.default as unknown as Recipe[]).map((r) => Object.freeze(r) as Recipe);
    AF.value = a.default as Record<string, AirFryerInfo>;
    MO.value = m.default as Record<string, MicrowaveInfo>;
    catalogReady.value = true;
  });
}

function handleIncomingLink(q: URLSearchParams) {
  const sync = decodeSync(q.get("sync"));
  if (sync) {
    openSheet("import", { sync });
    return true;
  }
  const rp = decodeRecipe(q.get("rp"));
  if (rp) {
    openSheet("import", { recipe: rp });
    return true;
  }
  const rid = q.get("r");
  if (rid && findRecipe(rid)) {
    const p = parseInt(q.get("p") || "", 10);
    openOverlay({ kind: "recipe", id: rid, portions: p > 0 && p <= 50 ? p : undefined });
    return true;
  }
  return false;
}

export async function boot() {
  const incoming = new URLSearchParams(location.search);
  const pCat = loadCatalog();
  // la session est lue AVANT de nettoyer l'adresse : un retour de connexion Google
  // ou de lien e-mail y porte ses jetons
  const pAuth = initAuth();
  await pCat;
  await pAuth;
  // adresse nettoyée + entrée « tampon » : le premier retour ne quitte pas l'application
  try {
    history.replaceState({ yummlyRoot: 1 }, "", location.pathname);
  } catch {
    /* ignore */
  }
  pushBuffer();
  const fromLink = handleIncomingLink(incoming);
  // 1re visite sans compte : on présente l'application (on peut passer)
  if (!fromLink && !user.value && !localGet("gabcook_seen_welcome")) openSheet("auth", { welcome: true });

  // service worker (hors ligne + mises à jour)
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    try {
      const { registerSW } = await import("virtual:pwa-register");
      registerSW({ immediate: true });
    } catch {
      /* ignore */
    }
  }
}
