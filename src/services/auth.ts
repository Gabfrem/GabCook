/* Connexion, inscription, déconnexion, réinitialisation du compte. */
import { batch } from "@preact/signals";
import { loadRatings, pushRecipes } from "../state/actions";
import {
  agenda,
  favorites,
  flush,
  hasPendingWrites,
  fridge,
  hydrate,
  KEYS,
  localDel,
  localSet,
  notes,
  perso,
  planned,
  profile,
  ratings,
  recipePhotos,
  seedCloudFromLocal,
  shopping,
  stats,
  user,
  type User
} from "../state/store";
import { openSheet, toast } from "../state/ui";
import { loadCommunityPhotos, loadCommunityRecipes, loadSocial, pushProfile, resetSocial } from "./social";
import { sb } from "./supabase";

let lastUid: string | null = null;

async function afterLogin() {
  if (!user.value) return;
  if (!profile.value.pseudo) profile.value = { ...profile.value, pseudo: (user.value.email || "").split("@")[0] };
  void pushProfile();
  void pushRecipes();
  void loadRatings();
  // les recettes des profils privés amis ne sont visibles qu'une fois les amis connus
  void loadSocial().then(loadCommunityRecipes);
  void loadCommunityPhotos();
}

async function handleSession(session: { user: { id: string; email?: string } } | null, initial = false) {
  const u: User | null = session && session.user ? { id: session.user.id, email: session.user.email || "" } : null;
  const uid = u ? u.id : null;
  if (uid === lastUid && !initial) return;
  const seConnecte = !!uid && !lastUid && !initial;
  lastUid = uid;
  if (seConnecte && uid) {
    const n = await seedCloudFromLocal(uid);
    if (n) toast("☁️ Les données de cet appareil ont été copiées sur ton compte");
  }
  user.value = u;
  resetSocial();
  await hydrate();
  if (u) await afterLogin();
  if (seConnecte) toast("✅ Connecté·e — tout est synchronisé");
}

export async function initAuth() {
  if (!sb) {
    await hydrate();
    return;
  }
  try {
    const { data } = await sb.auth.getSession();
    await handleSession(data.session as any, true);
  } catch {
    await hydrate();
  }
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === "PASSWORD_RECOVERY") openSheet("newPassword");
    void handleSession(s as any);
  });
  // revenir sur l'application rafraîchit les données du compte (autre appareil)
  let lastRefresh = Date.now();
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !user.value) return;
    if (Date.now() - lastRefresh < 60_000) return;
    lastRefresh = Date.now();
    if (hasPendingWrites()) await flush();
    await hydrate();
    void loadRatings();
  });
}

export function tradAuth(m: string): string {
  m = String(m || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already been")) return "Un compte existe déjà avec cet e-mail. Connecte-toi.";
  if (m.includes("email not confirmed")) return "Confirme d'abord ton e-mail (lien reçu à l'inscription).";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Attends une minute puis réessaie.";
  if (m.includes("password")) return "Mot de passe trop court (6 caractères minimum).";
  return "Ça n'a pas marché. Vérifie tes identifiants et réessaie.";
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!sb) return "Service de compte indisponible.";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? tradAuth(error.message) : null;
}
export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirm: boolean }> {
  if (!sb) return { error: "Service de compte indisponible.", needsConfirm: false };
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) return { error: tradAuth(error.message), needsConfirm: false };
  return { error: null, needsConfirm: !data.session };
}
export async function updatePassword(password: string): Promise<string | null> {
  if (!sb) return "Service de compte indisponible.";
  const { error } = await sb.auth.updateUser({ password });
  return error ? tradAuth(error.message) : null;
}
export async function resetPassword(email: string): Promise<string | null> {
  if (!sb) return "Service de compte indisponible.";
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  return error ? tradAuth(error.message) : null;
}
export async function signInWithGoogle(): Promise<string | null> {
  if (!sb) return "Service de compte indisponible.";
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
  if (error) return error.message.toLowerCase().includes("not enabled") ? "La connexion Google n'est pas activée." : "Connexion Google impossible pour le moment.";
  return null;
}
export async function signOut(silent = false) {
  if (!sb) return;
  await flush();
  try {
    await sb.auth.signOut();
  } catch {
    /* ignore */
  }
  lastUid = null;
  user.value = null;
  resetSocial();
  await hydrate();
  if (!silent) toast("Déconnecté·e — retour aux données de cet appareil");
}

/** Efface définitivement toutes les données du compte (et de l'appareil). */
export async function resetAccount() {
  if (sb && user.value) {
    const me = user.value.id;
    try {
      const { data: mine } = await sb.from("posts").select("photo_path").eq("author", me);
      const paths = (mine || []).map((p: any) => p.photo_path).filter(Boolean);
      if (paths.length) await sb.storage.from("dishes").remove(paths);
    } catch {
      /* ignore */
    }
    for (const [t, col] of [
      ["reactions", "user_id"],
      ["comments", "user_id"],
      ["posts", "author"],
      ["recipes", "author"],
      ["ratings", "user_id"]
    ] as const) {
      try {
        await sb.from(t).delete().eq(col, me);
      } catch {
        /* ignore */
      }
    }
    try {
      await sb.from("friendships").delete().or("requester.eq." + me + ",addressee.eq." + me);
      await sb.from("profiles").delete().eq("id", me);
      await sb.from("gabcook_store").delete().eq("user_id", me);
    } catch {
      /* ignore */
    }
  }
  KEYS.forEach((k) => localDel(k));
  localSet("gabcook_seen_welcome", true);
  batch(() => {
    fridge.value = [];
    shopping.value = [];
    perso.value = [];
    recipePhotos.value = {};
    notes.value = {};
    agenda.value = {};
    favorites.value = [];
    planned.value = [];
    ratings.value = {};
    profile.value = { pseudo: "", avatar: "", bio: "", isPrivate: false, banner: "", bannerPos: 50 };
    stats.value = { cooked: 0, byRecipe: {}, firstAt: null, lastAt: null, history: [] };
  });
  await signOut(true);
  toast("✅ Compte réinitialisé — tout repart de zéro");
}
