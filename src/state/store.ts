/* ==========================================================================
   ÉTAT DE L'APPLICATION
   Un signal par donnée. Les composants qui lisent `.value` se mettent à jour seuls.
   Les données de l'utilisateur sont enregistrées sous les MÊMES clés que la v1
   (gabcook_*) : en local sur l'appareil, ou dans la table gabcook_store une fois
   connecté. Rien n'est perdu au passage à la nouvelle version.
   ========================================================================== */
import { computed, effect, signal } from "@preact/signals";
import type { FridgeItem } from "../core/fridge";
import { purgeAgenda, type Agenda } from "../core/planner";
import { sanitizeRecipe, type AirFryerInfo, type CookMode, type MicrowaveInfo, type Recipe } from "../core/recipe";
import { clean } from "../core/text";
import { sb } from "../services/supabase";

/* ---------------- types ---------------- */
export interface ShoppingItem {
  id: number;
  label: string;
  base: string;
  q: number | null;
  u: string;
  from: string;
  checked: boolean;
}
export interface Profile {
  pseudo: string;
  avatar: string;
  bio: string;
  isPrivate: boolean;
  banner: string;
  bannerPos: number;
}
export interface Stats {
  cooked: number;
  byRecipe: Record<string, number>;
  firstAt: number | null;
  lastAt: number | null;
  /** historique des plats réalisés (récent en dernier), limité à 400 entrées */
  history?: { id: string; at: number }[];
}
export interface Semaine {
  equip: string[] | null;
  prefs: { deteste: string[]; allerg: string[] };
  cuisine: string;
  nb: number;
  budget: number;
  plats: string[];
  creeLe: number | null;
  creneaux: "tous" | "midi" | "soir";
}
export interface Settings {
  /** appliquer mes allergies / aversions partout (pas seulement au planning) */
  appliquerPrefs: boolean;
  /** n'afficher que des recettes végétariennes */
  vege: boolean;
  /** lire les étapes à voix haute en mode cuisine */
  voix: boolean;
  /** nombre de personnes par défaut (0 = celui de la recette) */
  personnes: number;
}
export interface User {
  id: string;
  email: string;
}

/* ---------------- catalogue ---------------- */
export const catalog = signal<Recipe[]>([]);
export const catalogReady = signal(false);
export const AF = signal<Record<string, AirFryerInfo>>({});
export const MO = signal<Record<string, MicrowaveInfo>>({});

/* ---------------- données de l'utilisateur ---------------- */
export const user = signal<User | null>(null);
export const perso = signal<Recipe[]>([]);
export const fridge = signal<FridgeItem[]>([]);
export const shopping = signal<ShoppingItem[]>([]);
export const favorites = signal<string[]>([]);
export const planned = signal<string[]>([]);
export const ratings = signal<Record<string, number>>({});
export const ratingsGlobal = signal<Record<string, { sum: number; n: number }>>({});
export const notes = signal<Record<string, string>>({});
export const stats = signal<Stats>({ cooked: 0, byRecipe: {}, firstAt: null, lastAt: null, history: [] });
export const recipePhotos = signal<Record<string, string>>({});
export const profile = signal<Profile>({ pseudo: "", avatar: "", bio: "", isPrivate: false, banner: "", bannerPos: 50 });
export const semaine = signal<Semaine>({
  equip: null,
  prefs: { deteste: [], allerg: [] },
  cuisine: "",
  nb: 5,
  budget: 40,
  plats: [],
  creeLe: null,
  creneaux: "tous"
});
export const agenda = signal<Agenda>({});
export const cookMode = signal<CookMode>("normal");
export const settings = signal<Settings>({ appliquerPrefs: false, vege: false, voix: false, personnes: 0 });
/** photos publiées par la communauté, par recette (chargées si connecté) */
export const communityPhotos = signal<Record<string, { url: string; author: string; pseudo?: string }[]>>({});
/** l'hydratation initiale est terminée */
export const hydrated = signal(false);

export const allRecipes = computed(() => catalog.value.concat(perso.value));
export const recipeById = computed(() => {
  const m = new Map<string, Recipe>();
  for (const r of allRecipes.value) m.set(r.id, r);
  return m;
});
export const findRecipe = (id: string | null | undefined): Recipe | null => (id ? recipeById.value.get(id) || null : null);
export const isAdmin = computed(() => !!(user.value && ["gabin.fremin@gmail.com"].includes((user.value.email || "").toLowerCase())));
export const cloudActif = () => !!(sb && user.value);

/* ==========================================================================
   STOCKAGE : local (appareil) ou cloud (compte). Le cloud est la source de vérité
   une fois connecté : on ne lit jamais le local dans ce cas, pour ne pas mélanger
   les données de deux comptes utilisés sur le même appareil.
   ========================================================================== */
const _mem: Record<string, unknown> = {};
export function localGet<T = unknown>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return (_mem[key] as T) ?? null;
  }
}
export function localSet(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    _mem[key] = val;
  }
}
export function localDel(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    delete _mem[key];
  }
}

export const KEYS = [
  "gabcook_fridge",
  "gabcook_shopping",
  "gabcook_airfryer",
  "gabcook_micro",
  "gabcook_perso",
  "gabcook_profile",
  "gabcook_stats",
  "gabcook_photos",
  "gabcook_favorites",
  "gabcook_semaine",
  "gabcook_ratings",
  "gabcook_agenda",
  "gabcook_notes",
  "gabcook_planned",
  "gabcook_settings"
] as const;
type Key = (typeof KEYS)[number];

async function storeGetMany(keys: readonly string[], uid: string | null): Promise<Record<string, unknown>> {
  if (uid && sb) {
    const { data, error } = await sb.from("gabcook_store").select("key,value").in("key", keys as string[]);
    if (error) throw error;
    const m: Record<string, unknown> = {};
    (data || []).forEach((r: any) => {
      m[r.key] = r.value;
    });
    return m;
  }
  const m: Record<string, unknown> = {};
  keys.forEach((k) => (m[k] = localGet(k)));
  return m;
}

/* ---------- écritures différées ----------
   Chaque modification part vers la destination valable AU MOMENT du changement
   (appareil ou compte) : une connexion pendant l'attente n'envoie pas les données
   locales dans le compte. */
const pending = new Map<string, { key: Key; value: unknown; uid: string | null }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
export const syncState = signal<"idle" | "saving" | "error">("idle");
function queueWrite(key: Key, value: unknown) {
  const uid = user.value ? user.value.id : null;
  pending.set((uid || "local") + "|" + key, { key, value, uid });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 350);
}
export async function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const items = [...pending.values()];
  pending.clear();
  if (!items.length) return;
  const cloud = items.filter((i) => i.uid);
  items.filter((i) => !i.uid).forEach((i) => localSet(i.key, i.value));
  if (cloud.length && sb) {
    syncState.value = "saving";
    try {
      const now = new Date().toISOString();
      const { error } = await sb.from("gabcook_store").upsert(cloud.map((i) => ({ user_id: i.uid, key: i.key, value: i.value, updated_at: now })));
      if (error) throw error;
      syncState.value = "idle";
    } catch {
      // on garde les données en attente pour un prochain essai
      cloud.forEach((i) => pending.set(i.uid + "|" + i.key, i));
      syncState.value = "error";
      flushTimer = setTimeout(flush, 8000);
    }
  }
}
export const hasPendingWrites = () => pending.size > 0;
if (typeof window !== "undefined") {
  addEventListener("pagehide", () => {
    void flush();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}

/* ---------- liaison signal <-> clé ---------- */
let hydrating = false;
function persist<T>(key: Key, sig: { value: T }, serialize: (v: T) => unknown = (v) => v) {
  let first = true;
  effect(() => {
    const v = sig.value;
    if (first) {
      first = false;
      return;
    }
    if (hydrating || !hydrated.peek()) return;
    queueWrite(key, serialize(v));
  });
}
persist("gabcook_fridge", fridge);
persist("gabcook_shopping", shopping);
persist("gabcook_perso", perso);
persist("gabcook_profile", profile);
persist("gabcook_stats", stats);
persist("gabcook_photos", recipePhotos);
persist("gabcook_favorites", favorites);
persist("gabcook_semaine", semaine);
persist("gabcook_ratings", ratings);
persist("gabcook_agenda", agenda);
persist("gabcook_notes", notes);
persist("gabcook_planned", planned);
persist("gabcook_settings", settings);
// le mode de cuisson reste stocké sous les deux booléens de la v1
effect(() => {
  const m = cookMode.value;
  if (hydrating || !hydrated.peek()) return;
  queueWrite("gabcook_airfryer", m === "airfryer");
  queueWrite("gabcook_micro", m === "micro");
});

/* ---------- lecture ---------- */
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : null);
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export async function hydrate(): Promise<boolean> {
  const uid = user.value ? user.value.id : null;
  let h: Record<string, unknown>;
  try {
    h = await storeGetMany(KEYS, uid);
  } catch {
    return false; // connecté mais lecture impossible : on ne retombe pas sur le local d'un autre compte
  }
  hydrating = true;
  try {
    const f = h.gabcook_fridge;
    fridge.value = Array.isArray(f)
      ? f
          .map((x: any) =>
            typeof x === "string"
              ? { n: x, q: null, u: "" }
              : { n: clean(x && x.n), q: x && typeof x.q === "number" ? x.q : null, u: (x && x.u) || "", exp: (x && x.exp) || null, added: x && x.added }
          )
          .filter((x) => x.n)
      : [];
    const s = h.gabcook_shopping;
    let nextId = 1;
    shopping.value = Array.isArray(s)
      ? s
          .map((x: any) => ({
            id: typeof x.id === "number" ? x.id : 0,
            label: clean(x.label),
            base: clean(x.base || x.label),
            q: typeof x.q === "number" ? x.q : null,
            u: x.u || "",
            from: clean(x.from || ""),
            checked: !!x.checked
          }))
          .filter((x) => x.label)
      : [];
    shopping.value.forEach((x) => (nextId = Math.max(nextId, x.id + 1)));
    shopping.value = shopping.value.map((x) => (x.id ? x : { ...x, id: nextId++ }));
    const mode: CookMode = h.gabcook_micro === true ? "micro" : h.gabcook_airfryer === true ? "airfryer" : "normal";
    cookMode.value = mode;
    perso.value = Array.isArray(h.gabcook_perso) ? (h.gabcook_perso as unknown[]).map(sanitizeRecipe).filter((x): x is Recipe => !!x) : [];
    const pr = obj(h.gabcook_profile);
    profile.value = pr
      ? {
          pseudo: clean(pr.pseudo),
          avatar: pr.avatar || "",
          bio: clean(pr.bio),
          isPrivate: !!pr.isPrivate,
          banner: pr.banner || "",
          bannerPos: pr.bannerPos == null ? 50 : +pr.bannerPos
        }
      : { pseudo: "", avatar: "", bio: "", isPrivate: false, banner: "", bannerPos: 50 };
    const st = obj(h.gabcook_stats);
    stats.value = st
      ? {
          cooked: +st.cooked || 0,
          byRecipe: obj(st.byRecipe) || {},
          firstAt: st.firstAt || null,
          lastAt: st.lastAt || null,
          history: Array.isArray(st.history) ? st.history.filter((x: any) => x && typeof x.id === "string") : []
        }
      : { cooked: 0, byRecipe: {}, firstAt: null, lastAt: null, history: [] };
    recipePhotos.value = (obj(h.gabcook_photos) as Record<string, string>) || {};
    favorites.value = strArr(h.gabcook_favorites);
    planned.value = strArr(h.gabcook_planned);
    const sem = obj(h.gabcook_semaine);
    const base = semaine.peek();
    semaine.value = sem
      ? {
          ...base,
          ...sem,
          equip: Array.isArray(sem.equip) ? sem.equip : null,
          prefs: { deteste: strArr(sem.prefs && sem.prefs.deteste), allerg: strArr(sem.prefs && sem.prefs.allerg) },
          plats: strArr(sem.plats),
          nb: Math.max(1, Math.min(14, +sem.nb || 5)),
          budget: +sem.budget || 40
        }
      : { equip: null, prefs: { deteste: [], allerg: [] }, cuisine: "", nb: 5, budget: 40, plats: [], creeLe: null, creneaux: "tous" };
    ratings.value = (obj(h.gabcook_ratings) as Record<string, number>) || {};
    agenda.value = purgeAgenda((obj(h.gabcook_agenda) as Agenda) || {});
    notes.value = (obj(h.gabcook_notes) as Record<string, string>) || {};
    const se = obj(h.gabcook_settings);
    settings.value = { appliquerPrefs: !!(se && se.appliquerPrefs), vege: !!(se && se.vege), voix: !!(se && se.voix), personnes: (se && +se.personnes) || 0 };
  } finally {
    hydrating = false;
  }
  hydrated.value = true;
  return true;
}

/** À la 1re connexion, si le compte est vide, on y verse ce qui était sur l'appareil. */
export async function seedCloudFromLocal(uid: string): Promise<number> {
  if (!sb) return 0;
  try {
    const { data } = await sb.from("gabcook_store").select("key").eq("user_id", uid).limit(1);
    if (data && data.length) return 0;
  } catch {
    return 0;
  }
  const now = new Date().toISOString();
  const rows = KEYS.map((k) => ({ user_id: uid, key: k, value: localGet(k), updated_at: now })).filter((r) => r.value != null);
  if (!rows.length) return 0;
  try {
    await sb.from("gabcook_store").upsert(rows);
  } catch {
    return 0;
  }
  return rows.length;
}

/** Thème : réglage propre à l'appareil. */
export type Theme = "auto" | "light" | "dark";
export const theme = signal<Theme>(((): Theme => {
  const t = localGet<string>("gabcook_theme");
  return t === "dark" || t === "light" ? t : "auto";
})());
effect(() => {
  const t = theme.value;
  if (t === "auto") localDel("gabcook_theme");
  else localSet("gabcook_theme", t);
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#101814" : "#FBF5E6");
});
