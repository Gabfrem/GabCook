/* Réseau social : profils publics, amis, fil de publications, réactions, commentaires.
   Tout passe par les tables profiles / friendships / posts / reactions / comments,
   dont les règles RLS garantissent qu'on ne voit et ne modifie que ce qui nous concerne. */
import { batch, signal } from "@preact/signals";
import { sanitizeRecipe, type Recipe } from "../core/recipe";
import { displayName } from "../state/actions";
import { cloudActif, communityPhotos, profile, recipePhotos, user } from "../state/store";
import { sb } from "./supabase";

export interface PublicProfile {
  id: string;
  pseudo: string;
  avatar: string;
  bio?: string;
  is_private?: boolean;
  banner?: string;
  banner_pos?: number;
}
export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  prof: PublicProfile;
}
export interface Post {
  id: string;
  author: string;
  recipe_id: string | null;
  recipe_name: string | null;
  emoji: string | null;
  photo_path: string | null;
  photo_url: string | null;
  description: string | null;
  visibility: "public" | "friends";
  created_at: string;
  prof: PublicProfile;
  likeCount: number;
  liked: boolean;
  comments: Comment[];
}

export const friends = signal<PublicProfile[]>([]);
export const incoming = signal<PublicProfile[]>([]);
export const outgoing = signal<PublicProfile[]>([]);
export const socialLoaded = signal(false);
export const feed = signal<Post[]>([]);
export const feedState = signal<"idle" | "loading" | "ready" | "error">("idle");

const anon = (id: string): PublicProfile => ({ id, pseudo: "?", avatar: "" });

async function profilesOf(ids: string[]): Promise<Record<string, PublicProfile>> {
  const out: Record<string, PublicProfile> = {};
  if (!sb || !ids.length) return out;
  const { data } = await sb.from("profiles").select("id,pseudo,avatar").in("id", ids);
  (data || []).forEach((p: any) => (out[p.id] = p));
  return out;
}

export function resetSocial() {
  batch(() => {
    friends.value = [];
    incoming.value = [];
    outgoing.value = [];
    socialLoaded.value = false;
    feed.value = [];
    feedState.value = "idle";
    communityRecipes.value = [];
  });
}

/** Miroir du profil dans la table publique, pour être trouvable par pseudo. */
export async function pushProfile() {
  if (!cloudActif() || !sb) return;
  const p = profile.value;
  const full = {
    id: user.value!.id,
    pseudo: p.pseudo || displayName(),
    avatar: p.avatar || "",
    bio: p.bio || "",
    is_private: !!p.isPrivate,
    banner: p.banner || "",
    banner_pos: p.bannerPos == null ? 50 : p.bannerPos,
    updated_at: new Date().toISOString()
  };
  try {
    const { error } = await sb.from("profiles").upsert(full);
    if (error) await sb.from("profiles").upsert({ id: full.id, pseudo: full.pseudo, avatar: full.avatar, updated_at: full.updated_at });
  } catch {
    /* ignore */
  }
}

export async function loadSocial() {
  if (!cloudActif() || !sb) {
    socialLoaded.value = true;
    return;
  }
  const me = user.value!.id;
  try {
    const { data: links } = await sb.from("friendships").select("*").or("requester.eq." + me + ",addressee.eq." + me);
    const rows = links || [];
    const ids = [...new Set(rows.map((r: any) => (r.requester === me ? r.addressee : r.requester)))] as string[];
    const profs = await profilesOf(ids);
    const prof = (id: string) => profs[id] || anon(id);
    batch(() => {
      friends.value = rows.filter((r: any) => r.status === "accepted").map((r: any) => prof(r.requester === me ? r.addressee : r.requester));
      incoming.value = rows.filter((r: any) => r.status === "pending" && r.addressee === me).map((r: any) => prof(r.requester));
      outgoing.value = rows.filter((r: any) => r.status === "pending" && r.requester === me).map((r: any) => prof(r.addressee));
    });
  } catch {
    /* ignore */
  }
  socialLoaded.value = true;
}
export function relationWith(id: string): "self" | "friend" | "incoming" | "outgoing" | null {
  if (user.value && id === user.value.id) return "self";
  if (friends.value.some((f) => f.id === id)) return "friend";
  if (incoming.value.some((f) => f.id === id)) return "incoming";
  if (outgoing.value.some((f) => f.id === id)) return "outgoing";
  return null;
}
export async function searchProfiles(q: string): Promise<PublicProfile[]> {
  if (!cloudActif() || !sb || q.trim().length < 2) return [];
  try {
    const { data } = await sb.from("profiles").select("id,pseudo,avatar").ilike("pseudo", q.trim() + "%").neq("id", user.value!.id).limit(20);
    return (data as PublicProfile[]) || [];
  } catch {
    return [];
  }
}
export async function addFriend(id: string) {
  if (!cloudActif() || !sb) return;
  if (relationWith(id) === "incoming") return acceptFriend(id);
  try {
    await sb.from("friendships").insert({ requester: user.value!.id, addressee: id, status: "pending" });
  } catch {
    /* ignore */
  }
  await loadSocial();
}
export async function acceptFriend(id: string) {
  if (!cloudActif() || !sb) return;
  try {
    await sb.from("friendships").update({ status: "accepted" }).eq("requester", id).eq("addressee", user.value!.id);
  } catch {
    /* ignore */
  }
  await loadSocial();
}
export async function removeFriend(id: string) {
  if (!cloudActif() || !sb) return;
  const me = user.value!.id;
  try {
    await sb.from("friendships").delete().or("and(requester.eq." + me + ",addressee.eq." + id + "),and(requester.eq." + id + ",addressee.eq." + me + ")");
  } catch {
    /* ignore */
  }
  await loadSocial();
}
export async function friendIdsOf(id: string): Promise<string[]> {
  if (!sb) return [];
  try {
    const { data } = await sb.from("friendships").select("requester,addressee").eq("status", "accepted").or("requester.eq." + id + ",addressee.eq." + id);
    return (data || []).map((r: any) => (r.requester === id ? r.addressee : r.requester));
  } catch {
    return [];
  }
}

/* ---------- publications ---------- */
async function enrich(rows: any[]): Promise<Post[]> {
  if (!sb) return [];
  const me = user.value ? user.value.id : "";
  const pids = rows.map((p) => p.id);
  let reacts: any[] = [],
    coms: any[] = [];
  if (pids.length) {
    const [r1, r2] = await Promise.all([
      sb.from("reactions").select("post_id,user_id").in("post_id", pids),
      sb.from("comments").select("id,post_id,user_id,text,created_at").in("post_id", pids).order("created_at", { ascending: true })
    ]);
    reacts = r1.data || [];
    coms = r2.data || [];
  }
  const profs = await profilesOf([...new Set(rows.map((p) => p.author).concat(coms.map((c) => c.user_id)))]);
  const prof = (id: string) => profs[id] || anon(id);
  const likeCount: Record<string, number> = {},
    liked: Record<string, boolean> = {},
    commentsBy: Record<string, Comment[]> = {};
  reacts.forEach((r) => {
    likeCount[r.post_id] = (likeCount[r.post_id] || 0) + 1;
    if (r.user_id === me) liked[r.post_id] = true;
  });
  coms.forEach((c) => (commentsBy[c.post_id] = commentsBy[c.post_id] || []).push({ ...c, prof: prof(c.user_id) }));
  return rows.map((p) => ({ ...p, prof: prof(p.author), likeCount: likeCount[p.id] || 0, liked: !!liked[p.id], comments: commentsBy[p.id] || [] }));
}
export async function loadFeed() {
  if (!cloudActif() || !sb) return;
  feedState.value = "loading";
  try {
    const { data, error } = await sb.from("posts").select("*").order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    feed.value = await enrich(data || []);
    feedState.value = "ready";
  } catch {
    feedState.value = "error";
  }
}
export async function loadPost(id: string): Promise<Post | null> {
  if (!cloudActif() || !sb) return null;
  try {
    const { data } = await sb.from("posts").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    return (await enrich([data]))[0];
  } catch {
    return null;
  }
}
function patchPost(id: string, fn: (p: Post) => Post) {
  feed.value = feed.value.map((p) => (p.id === id ? fn(p) : p));
}
export async function toggleLike(p: Post): Promise<Post> {
  if (!cloudActif() || !sb) return p;
  const me = user.value!.id;
  const next = { ...p, liked: !p.liked, likeCount: p.likeCount + (p.liked ? -1 : 1) };
  patchPost(p.id, () => next);
  try {
    if (p.liked) await sb.from("reactions").delete().eq("post_id", p.id).eq("user_id", me);
    else await sb.from("reactions").insert({ post_id: p.id, user_id: me, emoji: "❤️" });
  } catch {
    patchPost(p.id, () => p);
    return p;
  }
  return next;
}
export async function addComment(p: Post, text: string): Promise<Post> {
  const t = text.replace(/[<>]/g, "").trim().slice(0, 500);
  if (!t || !cloudActif() || !sb) return p;
  try {
    const { data, error } = await sb.from("comments").insert({ post_id: p.id, user_id: user.value!.id, text: t }).select().single();
    if (error) throw error;
    const me: PublicProfile = { id: user.value!.id, pseudo: displayName(), avatar: profile.value.avatar };
    const next = { ...p, comments: [...p.comments, { ...(data as any), prof: me }] };
    patchPost(p.id, () => next);
    return next;
  } catch {
    return p;
  }
}
export async function deleteComment(p: Post, cid: string): Promise<Post> {
  if (!cloudActif() || !sb) return p;
  try {
    await sb.from("comments").delete().eq("id", cid);
  } catch {
    return p;
  }
  const next = { ...p, comments: p.comments.filter((c) => c.id !== cid) };
  patchPost(p.id, () => next);
  return next;
}
export async function deletePost(p: Post) {
  if (!cloudActif() || !sb) return;
  try {
    if (p.photo_path && p.author === user.value!.id) await sb.storage.from("dishes").remove([p.photo_path]);
  } catch {
    /* ignore */
  }
  try {
    await sb.from("posts").delete().eq("id", p.id);
  } catch {
    /* ignore */
  }
  feed.value = feed.value.filter((x) => x.id !== p.id);
}

/** Traduit les erreurs de publication en message clair. */
function tradPost(m: string, quoi: "photo" | "post"): string {
  const s = String(m || "").toLowerCase();
  if (s.includes("bucket not found")) return "L'espace photo « dishes » n'existe pas dans Supabase.";
  if (s.includes("row-level security") || s.includes("violates") || s.includes("permission"))
    return quoi === "photo" ? "Envoi de photo refusé (droits d'upload)." : "Publication refusée (droits de la table posts).";
  return (quoi === "photo" ? "Envoi de la photo impossible : " : "Publication impossible : ") + m;
}
export async function publishPost(d: { recipeId: string; recipeName: string; emoji: string; blob: Blob; description: string; visibility: "public" | "friends" }): Promise<string | null> {
  if (!cloudActif() || !sb) return "Connecte-toi pour publier.";
  const uid = user.value!.id;
  const path = uid + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
  const up = await sb.storage.from("dishes").upload(path, d.blob, { contentType: "image/jpeg", upsert: false });
  if (up.error) return tradPost(up.error.message, "photo");
  const photo_url = sb.storage.from("dishes").getPublicUrl(path).data.publicUrl;
  const { error } = await sb.from("posts").insert({
    author: uid,
    recipe_id: d.recipeId,
    recipe_name: d.recipeName,
    emoji: d.emoji,
    photo_path: path,
    photo_url,
    description: d.description.replace(/[<>]/g, "").trim().slice(0, 500),
    visibility: d.visibility
  });
  if (error) return tradPost(error.message, "post");
  // cette photo devient la vignette de la recette chez moi
  recipePhotos.value = { ...recipePhotos.value, [d.recipeId]: photo_url };
  feedState.value = "idle";
  return null;
}

/* ---------- profils ---------- */
export interface ProfileData {
  data: PublicProfile;
  locked: boolean;
  posts: { id: string; recipe_id: string | null; recipe_name: string | null; emoji: string | null; photo_url: string | null; created_at: string }[];
  friendIds: string[];
  recipes: { id: string; author_name: string | null; data: any; created_at: string }[];
}
export async function loadProfileData(id: string): Promise<ProfileData | null> {
  if (!cloudActif() || !sb) return null;
  const mine = id === user.value!.id;
  if (!socialLoaded.value) await loadSocial();
  let data: PublicProfile;
  if (mine) {
    const p = profile.value;
    data = { id, pseudo: displayName(), avatar: p.avatar, bio: p.bio, is_private: p.isPrivate, banner: p.banner, banner_pos: p.bannerPos };
  } else {
    const r = await sb.from("profiles").select("id,pseudo,avatar,bio,is_private,banner,banner_pos").eq("id", id).maybeSingle();
    data = (r.data as PublicProfile) || anon(id);
  }
  const locked = !mine && !!data.is_private && relationWith(id) !== "friend";
  if (locked) return { data, locked, posts: [], friendIds: [], recipes: [] };
  const [fids, posts, recs] = await Promise.all([
    mine ? Promise.resolve(friends.value.map((f) => f.id)) : friendIdsOf(id),
    sb.from("posts").select("id,recipe_id,recipe_name,emoji,photo_url,created_at,visibility").eq("author", id).order("created_at", { ascending: false }).limit(200),
    sb.from("recipes").select("id,author_name,data,created_at").eq("author", id).order("created_at", { ascending: false }).limit(200)
  ]);
  return {
    data,
    locked,
    posts: ((posts.data as any[]) || []).filter((p) => p.photo_url),
    friendIds: fids,
    recipes: (recs.data as any[]) || []
  };
}
export async function loadProfilesByIds(ids: string[]): Promise<PublicProfile[]> {
  const m = await profilesOf(ids);
  return ids.map((id) => m[id] || anon(id));
}

/* ---------- recettes de la communauté ----------
   Les recettes créées par les membres (table publique recipes) viennent enrichir le
   choix de tout le monde. On ne montre que celles des profils publics, et celles des
   amis pour les profils privés. Elles s'ouvrent en aperçu : un geste les ajoute à
   « Mes recettes ». */
export const communityRecipes = signal<Recipe[]>([]);
export async function loadCommunityRecipes() {
  if (!cloudActif() || !sb) return;
  try {
    const me = user.value && user.value.id;
    const { data } = await sb.from("recipes").select("id,author,author_name,data,updated_at").order("updated_at", { ascending: false }).limit(150);
    const rows = ((data as any[]) || []).filter((row) => row && row.author !== me);
    if (!rows.length) {
      communityRecipes.value = [];
      return;
    }
    const ids = [...new Set(rows.map((row) => row.author as string))];
    const { data: profs } = await sb.from("profiles").select("id,pseudo,is_private").in("id", ids);
    const parId = new Map(((profs as any[]) || []).map((p) => [p.id as string, p]));
    const out: Recipe[] = [];
    const vus = new Set<string>();
    for (const row of rows) {
      const p = parId.get(row.author);
      if (!p || (p.is_private && relationWith(row.author) !== "friend")) continue;
      const r = sanitizeRecipe({ ...(row.data || {}), id: row.id, credit: p.pseudo || row.author_name || "" });
      // même nom chez le même auteur : on garde la version la plus récente
      const cle = row.author + "|" + (r ? r.nom.toLowerCase() : "");
      if (!r || vus.has(cle)) continue;
      vus.add(cle);
      out.push({ ...r, perso: false, _preview: true });
    }
    communityRecipes.value = out;
  } catch {
    /* ignore : l'étagère reste simplement cachée */
  }
}

/* ---------- photos de la communauté ----------
   Les photos publiées par les utilisateurs illustrent les recettes pour tout le monde :
   le catalogue se remplit de vraies photos au fil des plats réalisés. */
export async function loadCommunityPhotos() {
  if (!cloudActif() || !sb) return;
  try {
    const { data } = await sb
      .from("posts")
      .select("recipe_id,photo_url,author,created_at")
      .not("photo_url", "is", null)
      .not("recipe_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    const m: Record<string, { url: string; author: string }[]> = {};
    (data || []).forEach((p: any) => {
      if (!p.recipe_id || !p.photo_url) return;
      (m[p.recipe_id] = m[p.recipe_id] || []).push({ url: p.photo_url, author: p.author });
    });
    communityPhotos.value = m;
  } catch {
    /* ignore */
  }
}
