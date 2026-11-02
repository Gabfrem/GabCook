/* Actions de l'utilisateur : chacune met à jour l'état (donc l'écran et la sauvegarde)
   et, quand c'est utile, propose « Annuler ». */
import { batch } from "@preact/signals";
import { productInfo } from "../core/catalog";
import { plannable, respectsDiet } from "../core/classify";
import { addDays, addToFridge, debitFridge } from "../core/fridge";
import { pantryName, separeQuantite } from "../core/ingredients";
import { cleJour, poseRestes, poseSlot, recettesAgenda, slotDe, Tirage, tirageMultiple, creneaux, type Meal, type Slot } from "../core/planner";
import { prixRecette } from "../core/pricing";
import { isOriginalRecipe, recipeData, sanitizeRecipe, type CookMode, type Recipe } from "../core/recipe";
import { aggregateNeeds, mergeItem, missingAsItems, nextId, type ShopItem } from "../core/shopping";
import { cap, clean, count } from "../core/text";
import { sb } from "../services/supabase";
import {
  agenda,
  allRecipes,
  cloudActif,
  cookMode,
  favorites,
  findRecipe,
  fridge,
  notes,
  perso,
  planned,
  ratings,
  ratingsGlobal,
  recipePhotos,
  semaine,
  settings,
  shopping,
  stats,
  user,
  profile
} from "./store";
import { toast } from "./ui";

/* ======================= FRIGO ======================= */
export function addFridge(nameRaw: string, qIn: number | null, uIn: string, exp?: string | null) {
  let { n, q, u } = { n: nameRaw, q: qIn, u: uIn };
  if (q == null) {
    const s = separeQuantite(nameRaw);
    n = s.n;
    q = s.q;
    u = s.u || uIn;
  }
  n = clean(n);
  if (!n) return;
  fridge.value = addToFridge(fridge.value, n, q, u || "", exp);
  return pantryName(n);
}
export function updateFridgeItem(i: number, patch: Partial<{ q: number | null; u: string; exp: string | null; n: string }>) {
  const next = fridge.value.slice();
  if (!next[i]) return;
  next[i] = { ...next[i], ...patch };
  fridge.value = next;
}
export function removeFridgeItem(i: number) {
  const avant = fridge.value;
  const it = avant[i];
  if (!it) return;
  fridge.value = avant.filter((_, k) => k !== i);
  toast("« " + cap(it.n) + " » retiré du frigo", { label: "Annuler", run: () => (fridge.value = avant) });
}
export function clearFridge() {
  const avant = fridge.value;
  if (!avant.length) return;
  fridge.value = [];
  toast("Frigo vidé", { label: "Annuler", run: () => (fridge.value = avant) });
}

/* ======================= COURSES ======================= */
export function addShopping(labelRaw: string, qIn: number | null, uIn: string, from = "") {
  let { n, q, u } = { n: labelRaw, q: qIn, u: uIn };
  if (q == null) {
    const s = separeQuantite(labelRaw);
    n = s.n;
    q = s.q;
    u = s.u || uIn;
  }
  n = clean(n);
  if (!n) return false;
  const base = pantryName(n);
  const { list, merged } = mergeItem(shopping.value, { label: cap(base), base, q, u: u || "", from });
  shopping.value = list;
  return merged;
}
export function toggleShopping(id: number) {
  shopping.value = shopping.value.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s));
}
export function updateShopping(id: number, patch: Partial<ShopItem>) {
  shopping.value = shopping.value.map((s) => (s.id === id ? { ...s, ...patch } : s));
}
export function removeShopping(id: number) {
  const avant = shopping.value;
  const it = avant.find((s) => s.id === id);
  shopping.value = avant.filter((s) => s.id !== id);
  if (it) toast("« " + it.label + " » retiré", { label: "Annuler", run: () => (shopping.value = avant) });
}
export function clearShopping(onlyChecked = false) {
  const avant = shopping.value;
  const next = onlyChecked ? avant.filter((s) => !s.checked) : [];
  if (next.length === avant.length) return;
  shopping.value = next;
  toast(onlyChecked ? "Articles cochés retirés" : "Liste vidée", { label: "Annuler", run: () => (shopping.value = avant) });
}
/** Range les articles cochés dans le frigo, avec une date limite estimée pour les produits frais. */
export function stockChecked(ids?: number[]) {
  const pris = shopping.value.filter((s) => s.checked && (!ids || ids.includes(s.id)));
  if (!pris.length) return 0;
  const avantF = fridge.value,
    avantS = shopping.value;
  let f = fridge.value;
  for (const s of pris) {
    const shelf = productInfo(s.base || s.label).shelf;
    f = addToFridge(f, s.base || s.label, s.q, s.u || "", shelf != null ? addDays(shelf) : null);
  }
  batch(() => {
    fridge.value = f;
    shopping.value = shopping.value.filter((s) => !pris.includes(s));
  });
  toast("🧊 " + count(pris.length, "produit") + " rangé" + (pris.length > 1 ? "s" : "") + " dans le frigo", {
    label: "Annuler",
    run: () =>
      batch(() => {
        fridge.value = avantF;
        shopping.value = avantS;
      })
  });
  return pris.length;
}
/** Ajoute à la liste ce qui manque pour une recette ; la recette devient « prévue ». */
export function addMissingToShopping(r: Recipe, portions: number) {
  const factor = portions / (r.portions || 1);
  const items = missingAsItems(r, factor, fridge.value);
  let list = shopping.value,
    added = 0;
  for (const it of items) {
    const res = mergeItem(list, it);
    list = res.list;
    if (!res.merged) added++;
  }
  const avant = shopping.value,
    avantP = planned.value;
  batch(() => {
    shopping.value = list;
    if (!planned.value.includes(r.id)) planned.value = [r.id, ...planned.value];
  });
  toast(added ? count(added, "article") + " ajouté" + (added > 1 ? "s" : "") + " aux courses · 📌 recette prévue" : "Tout est déjà dans ta liste · 📌 recette prévue", {
    label: "Annuler",
    run: () =>
      batch(() => {
        shopping.value = avant;
        planned.value = avantP;
      })
  });
  return added;
}
/** Ingrédients des repas planifiés -> courses (cumulés, déduction faite du frigo). */
export function agendaToShopping() {
  const ids = recettesAgenda(agenda.value);
  const recs = ids.map((id) => findRecipe(id)).filter((r): r is Recipe => !!r);
  // un plat planifié deux fois compte deux fois
  const occ: Record<string, number> = {};
  creneaux().forEach((c) => {
    const s = slotDe(agenda.value, c.cle, c.repas);
    if (s && s.t === "r") occ[s.id] = (occ[s.id] || 0) + 1;
  });
  const { items, couverts } = aggregateNeeds(
    recs.map((r) => ({ r, factor: occ[r.id] || 1 })),
    fridge.value
  );
  const avant = shopping.value;
  let list = shopping.value,
    added = 0;
  for (const it of items) {
    const res = mergeItem(list, it);
    list = res.list;
    if (!res.merged) added++;
  }
  shopping.value = list;
  const msg = added
    ? count(added, "article") + " ajouté" + (added > 1 ? "s" : "") + " aux courses" + (couverts ? " · " + couverts + " déjà au frigo" : "")
    : couverts
      ? "Tout est déjà dans ton frigo"
      : "Tout est déjà dans ta liste";
  toast(msg, added ? { label: "Annuler", run: () => (shopping.value = avant) } : undefined);
}

/* ======================= CUISINER ======================= */
export function cookRecipe(r: Recipe, portions: number): { changed: number; missing: number } {
  const factor = portions / (r.portions || 1);
  const avantF = fridge.value,
    avantS = stats.value,
    avantP = planned.value;
  const { fridge: f, changed, missing } = debitFridge(fridge.value, r, factor);
  const s = stats.value;
  const now = Date.now();
  const history = (s.history || []).concat({ id: r.id, at: now }).slice(-400);
  batch(() => {
    fridge.value = f;
    stats.value = {
      cooked: (s.cooked || 0) + 1,
      byRecipe: { ...s.byRecipe, [r.id]: (s.byRecipe[r.id] || 0) + 1 },
      firstAt: s.firstAt || now,
      lastAt: now,
      history
    };
    planned.value = planned.value.filter((x) => x !== r.id);
  });
  toast(changed ? "🧊 Frigo mis à jour : " + count(changed, "ingrédient") + " débité" + (changed > 1 ? "s" : "") : "✅ Plat réalisé, bon appétit !", {
    label: "Annuler",
    run: () =>
      batch(() => {
        fridge.value = avantF;
        stats.value = avantS;
        planned.value = avantP;
      })
  });
  return { changed, missing };
}
export const timesCooked = (id: string) => stats.value.byRecipe[id] || 0;
export const lastCooked = (id: string): number | null => {
  const h = stats.value.history || [];
  for (let i = h.length - 1; i >= 0; i--) if (h[i].id === id) return h[i].at;
  return null;
};

/* ======================= FAVORIS, PRÉVUS, NOTES ======================= */
export function toggleFav(id: string) {
  const on = favorites.value.includes(id);
  favorites.value = on ? favorites.value.filter((x) => x !== id) : [id, ...favorites.value];
  return !on;
}
export const isFav = (id: string) => favorites.value.includes(id);
export const isPlanned = (id: string) => planned.value.includes(id);
export function togglePlanned(id: string) {
  planned.value = planned.value.includes(id) ? planned.value.filter((x) => x !== id) : [id, ...planned.value];
}
export function setNote(id: string, txt: string) {
  const t = clean(txt).slice(0, 1200);
  const next = { ...notes.value };
  if (t) next[id] = t;
  else delete next[id];
  notes.value = next;
}

/* ======================= NOTES EN ÉTOILES =======================
   Ma note est locale ET partagée (table `ratings`) : la note affichée est la moyenne
   de tous les utilisateurs, avec le nombre de votes. */
const LISSAGE = 5,
  BASE = 3;
export const myRating = (id: string) => ratings.value[id] || 0;
/** Moyenne bayésienne : un 5/5 à 1 vote ne passe pas devant un 4,8/5 à 30 votes. */
export function scoreNote(id: string): number {
  const g = ratingsGlobal.value[id];
  const n = g ? g.n : 0;
  if (!n) {
    const m = myRating(id);
    return m ? (m + LISSAGE * BASE) / (1 + LISSAGE) : 0;
  }
  return (g.sum + LISSAGE * BASE) / (n + LISSAGE);
}
export function globalRating(id: string): { moy: number; n: number } {
  const g = ratingsGlobal.value[id];
  if (g && g.n) return { moy: g.sum / g.n, n: g.n };
  const mine = myRating(id);
  return mine ? { moy: mine, n: 1 } : { moy: 0, n: 0 };
}
export function rateRecipe(id: string, n: number) {
  n = Math.max(0, Math.min(5, Math.round(n)));
  const avant = myRating(id);
  if (avant === n) n = 0; // re-toucher la même étoile retire la note
  const next = { ...ratings.value };
  if (n) next[id] = n;
  else delete next[id];
  const g = { ...(ratingsGlobal.value[id] || { sum: 0, n: 0 }) };
  if (avant) {
    g.sum -= avant;
    g.n--;
  }
  if (n) {
    g.sum += n;
    g.n++;
  }
  batch(() => {
    ratings.value = next;
    ratingsGlobal.value = { ...ratingsGlobal.value, [id]: g.n > 0 ? g : { sum: 0, n: 0 } };
  });
  void pushRating(id, n);
}
async function pushRating(id: string, n: number) {
  if (!cloudActif() || !sb) return;
  const uid = user.value!.id;
  try {
    if (n) await sb.from("ratings").upsert({ recipe_id: id, user_id: uid, stars: n }, { onConflict: "recipe_id,user_id" });
    else await sb.from("ratings").delete().eq("recipe_id", id).eq("user_id", uid);
  } catch {
    /* hors ligne : la note locale reste */
  }
}
export async function loadRatings() {
  if (!cloudActif() || !sb) return;
  try {
    const { data, error } = await sb.from("ratings").select("recipe_id,stars,user_id");
    if (error || !data) return;
    const agg: Record<string, { sum: number; n: number }> = {};
    const mine = { ...ratings.value };
    data.forEach((r: any) => {
      const a = agg[r.recipe_id] || (agg[r.recipe_id] = { sum: 0, n: 0 });
      a.sum += r.stars;
      a.n++;
      if (user.value && r.user_id === user.value.id) mine[r.recipe_id] = r.stars;
    });
    batch(() => {
      ratingsGlobal.value = agg;
      ratings.value = mine;
    });
  } catch {
    /* ignore */
  }
}

/* ======================= RECETTES PERSO ======================= */
export function savePersoRecipe(r: Recipe): Recipe | null {
  const clean = sanitizeRecipe(r);
  if (!clean) return null;
  clean.credit = r.credit || "";
  clean.src = r.src || "";
  const i = perso.value.findIndex((x) => x.id === clean.id);
  perso.value = i > -1 ? perso.value.map((x, k) => (k === i ? clean : x)) : [...perso.value, clean];
  void pushOneRecipe(clean);
  return clean;
}
export function deletePersoRecipe(id: string) {
  const avant = perso.value;
  const r = avant.find((x) => x.id === id);
  if (!r) return;
  perso.value = avant.filter((x) => x.id !== id);
  void unshareRecipe(id);
  toast("« " + r.nom + " » supprimée", {
    label: "Annuler",
    run: () => {
      perso.value = avant;
      void pushOneRecipe(r);
    }
  });
}
export function addPersoCopy(r: Recipe, credit = ""): Recipe | null {
  if (perso.value.some((x) => x.id === r.id)) return perso.value.find((x) => x.id === r.id)!;
  const c = sanitizeRecipe({ ...r, credit: credit || r.credit || "" });
  if (!c) return null;
  c.id = r.id && r.id.startsWith("perso-") ? r.id : "perso-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  c.credit = credit || r.credit || "";
  c.src = r.src || "";
  perso.value = [...perso.value, c];
  return c;
}
async function pushOneRecipe(r: Recipe) {
  if (!cloudActif() || !sb || !isOriginalRecipe(r)) return;
  try {
    await sb.from("recipes").upsert({
      id: r.id,
      author: user.value!.id,
      author_name: displayName(),
      data: recipeData(r),
      updated_at: new Date().toISOString()
    });
  } catch {
    /* ignore */
  }
}
export async function pushRecipes() {
  if (!cloudActif() || !sb) return;
  const rows = perso.value.filter(isOriginalRecipe).map((r) => ({
    id: r.id,
    author: user.value!.id,
    author_name: displayName(),
    data: recipeData(r),
    updated_at: new Date().toISOString()
  }));
  if (!rows.length) return;
  try {
    await sb.from("recipes").upsert(rows);
  } catch {
    /* ignore */
  }
}
async function unshareRecipe(id: string) {
  if (!cloudActif() || !sb) return;
  try {
    await sb.from("recipes").delete().eq("id", id);
  } catch {
    /* ignore */
  }
}
export function displayName(): string {
  return profile.value.pseudo || (user.value && user.value.email ? user.value.email.split("@")[0] : "Moi");
}

/* ======================= PHOTOS ======================= */
/** Photo à afficher pour une recette : la mienne, puis celle de la recette, puis la communauté. */
export function photoOf(r: Recipe): string {
  return recipePhotos.value[r.id] || r.photo || "";
}

/* ======================= PRÉFÉRENCES ======================= */
export function setCookMode(m: CookMode) {
  cookMode.value = cookMode.value === m ? "normal" : m;
}
/** Préférences alimentaires actives pour filtrer les suggestions. */
export function dietPrefs() {
  const s = settings.value;
  return {
    vege: s.vege,
    allerg: s.appliquerPrefs ? semaine.value.prefs.allerg : [],
    deteste: s.appliquerPrefs ? semaine.value.prefs.deteste : []
  };
}
export const fitsMe = (r: Recipe) => respectsDiet(r, dietPrefs());

/* ======================= SEMAINE ======================= */
const tirage = new Tirage((r) => 1 + Math.max(0, scoreNote(r.id) - 3) * 0.7 + (favorites.value.includes(r.id) ? 0.6 : 0));
export const pickVaried = (l: Recipe[]) => tirage.pick(l);
export const coutPlat = (r: Recipe) => prixRecette(r).parPers * 4;
export function candidatsSemaine(): Recipe[] {
  const s = semaine.value;
  return allRecipes.value.filter((r) => plannable(r, { equip: s.equip, prefs: s.prefs, cuisine: s.cuisine }) && (!settings.value.vege || respectsDiet(r, { vege: true, allerg: [], deteste: [] })));
}
export function assignRecipe(id: string, cle: string, repas: Meal) {
  agenda.value = poseSlot(agenda.value, cle, repas, { t: "r", id });
}
export function setSlot(cle: string, repas: Meal, slot: Slot | null) {
  const avant = agenda.value;
  agenda.value = poseSlot(agenda.value, cle, repas, slot);
  if (!slot) toast("Repas retiré", { label: "Annuler", run: () => (agenda.value = avant) });
}
export function eatLeftovers(cle: string, repas: Meal) {
  const avant = agenda.value;
  const res = poseRestes(agenda.value, cle, repas);
  agenda.value = res.agenda;
  toast(res.decale ? "♻️ Les restes · " + count(res.decale, "plat") + " décalé" + (res.decale > 1 ? "s" : "") : "♻️ Les restes notés", {
    label: "Annuler",
    run: () => (agenda.value = avant)
  });
}
/** Propose un plat pour un créneau (en évitant ce qui est déjà planifié). */
export function proposeFor(cle: string, repas: Meal): Recipe | null {
  const actuel = slotDe(agenda.value, cle, repas);
  const exclu = actuel && actuel.t === "r" ? actuel.id : null;
  const deja = recettesAgenda(agenda.value);
  let pool = candidatsSemaine().filter((r) => !deja.includes(r.id) && r.id !== exclu);
  if (!pool.length) pool = allRecipes.value.filter((r) => r.cat === "Plat" && r.id !== exclu);
  const r = tirage.pick(pool);
  if (!r) return null;
  agenda.value = poseSlot(agenda.value, cle, repas, { t: "r", id: r.id, gen: true });
  return r;
}
/** Remplit les créneaux libres des prochains jours selon les réglages de l'assistant. */
export function generateWeek(): number {
  const s = semaine.value;
  const pool = candidatsSemaine();
  const nb = Math.max(1, Math.min(14, s.nb || 5));
  const plats = tirageMultiple(pool, nb, s.budget || 0, coutPlat, tirage);
  // créneaux à remplir : on laisse en place ce qui est déjà planifié
  const libres = creneaux().filter((c) => {
    if (c.cle === cleJour(new Date()) && c.repas === "midi" && new Date().getHours() >= 14) return false;
    if (s.creneaux === "midi" && c.repas !== "midi") return false;
    if (s.creneaux === "soir" && c.repas !== "soir") return false;
    return !slotDe(agenda.value, c.cle, c.repas);
  });
  let a = agenda.value;
  let k = 0;
  for (const c of libres) {
    if (k >= plats.length) break;
    a = poseSlot(a, c.cle, c.repas, { t: "r", id: plats[k].id, gen: true });
    // midi seulement / soir seulement : le repas d'après, ce sont les restes
    if (s.creneaux !== "tous") {
      const all = creneaux();
      const i = all.findIndex((x) => x.cle === c.cle && x.repas === c.repas);
      const n = all[i + 1];
      if (n && !slotDe(a, n.cle, n.repas)) a = poseSlot(a, n.cle, n.repas, { t: "restes" });
    }
    k++;
  }
  const avant = agenda.value;
  batch(() => {
    agenda.value = a;
    semaine.value = { ...s, plats: plats.map((r) => r.id), creeLe: Date.now() };
  });
  toast("✨ " + count(k, "repas planifié", "repas planifiés"), { label: "Annuler", run: () => (agenda.value = avant) });
  return k;
}
export function clearAgenda() {
  const avant = agenda.value;
  agenda.value = {};
  toast("Semaine effacée", { label: "Annuler", run: () => (agenda.value = avant) });
}
