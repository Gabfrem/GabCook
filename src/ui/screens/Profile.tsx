import { useEffect, useState } from "preact/hooks";
import { sanitizeRecipe } from "../../core/recipe";
import { count } from "../../core/text";
import { loadPost, loadProfileData, loadProfilesByIds, type Post, type ProfileData, type PublicProfile } from "../../services/social";
import { addPersoCopy } from "../../state/actions";
import { perso, profile, stats, user } from "../../state/store";
import { closeOverlay, openOverlay, openSheet, toast } from "../../state/ui";
import { Avatar, Empty } from "../components/common";
import { Icon } from "../components/Icon";
import { openPreview } from "./RecipeDetail";
import { PersonRow, PostCard, RelationButton } from "./Social";

export const BANNERS: Record<string, string> = {
  camel: "linear-gradient(160deg,#2A5238 0%,#16311F 100%)",
  sunset: "linear-gradient(160deg,#F6B24B 0%,#E7663B 100%)",
  tomato: "linear-gradient(160deg,#E98A7B 0%,#C0392B 100%)",
  herb: "linear-gradient(160deg,#AECB8F 0%,#5E8A4E 100%)",
  berry: "linear-gradient(160deg,#C79BE0 0%,#7E4FA8 100%)",
  ocean: "linear-gradient(160deg,#8FD0E8 0%,#3E7FB0 100%)",
  cream: "linear-gradient(160deg,#F0E4D3 0%,#D8C3A5 100%)",
  night: "linear-gradient(160deg,#5B5A57 0%,#2B2A28 100%)"
};
export function bannerStyle(b?: string, pos?: number): Record<string, string> {
  const v = b || "";
  if (v.startsWith("data:") || v.startsWith("http")) return { backgroundImage: "url('" + v.replace(/["'()\\]/g, "") + "')", backgroundPosition: "center " + (pos == null ? 50 : pos) + "%" };
  const preset = v.startsWith("preset:") ? v.slice(7) : "camel";
  return { background: BANNERS[preset] || BANNERS.camel };
}

function Head({ title }: { title: string }) {
  return (
    <div class="ov-head">
      <button class="iconbtn" aria-label="Retour" onClick={closeOverlay}>
        <Icon name="back" />
      </button>
      <h1>{title}</h1>
    </div>
  );
}

export function ProfileScreen({ id }: { id: string }) {
  const [d, setD] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const me = user.value;
  const mine = !!me && me.id === id;
  const reload = () => {
    setLoading(true);
    void loadProfileData(id).then((x) => {
      setD(x);
      setLoading(false);
    });
  };
  useEffect(reload, [id, mine ? JSON.stringify(profile.value) : ""]);
  if (!me)
    return (
      <div class="overlay">
        <div class="ov-inner">
          <Head title="Profil" />
          <Empty icon="🔒" title="Connecte-toi" text="Les profils sont visibles une fois connecté·e.">
            <button class="btn primary" onClick={() => openSheet("auth")}>
              Se connecter
            </button>
          </Empty>
        </div>
      </div>
    );
  const data = d ? d.data : mine ? { id, pseudo: profile.value.pseudo, avatar: profile.value.avatar, bio: profile.value.bio, banner: profile.value.banner, banner_pos: profile.value.bannerPos } : null;
  return (
    <div class="overlay" role="dialog" aria-label="Profil">
      <div class="ov-inner">
        <div class="ov-head">
          <button class="iconbtn" aria-label="Retour" onClick={closeOverlay}>
            <Icon name="back" />
          </button>
          <h1>{mine ? "Mon profil" : (data && data.pseudo) || "Profil"}</h1>
          {mine && (
            <button class="iconbtn" aria-label="Réglages" onClick={() => openOverlay({ kind: "settings" })}>
              <Icon name="settings" />
            </button>
          )}
        </div>
        <div class="pbanner" style={bannerStyle(data?.banner, data?.banner_pos)}>
          {mine && (
            <button class="iconbtn glass" style={{ position: "absolute", top: 10, right: 10 }} aria-label="Personnaliser la bannière" onClick={() => openSheet("banner")}>
              🎨
            </button>
          )}
          <Avatar avatar={data?.avatar} name={data?.pseudo} size="xl" />
        </div>
        <div class="center" style={{ marginTop: 54 }}>
          <h2 style={{ fontSize: 26 }}>
            {data?.pseudo || "…"}
            {mine && profile.value.isPrivate && <span class="tag" style={{ marginLeft: 8, verticalAlign: "middle" }}>🔒 Privé</span>}
          </h2>
          {data?.bio ? <p class="muted mt-s">{data.bio}</p> : mine ? <p class="muted small mt-s">Ajoute une description dans « Modifier le profil ».</p> : null}
        </div>
        {d && !d.locked && (
          <div class="pstats">
            <div class="pstat">
              <b>{d.posts.length}</b>
              <span>🍽️ plats</span>
            </div>
            <button class="pstat" onClick={() => openOverlay({ kind: "friends", id, name: data?.pseudo || "" })}>
              <b>{d.friendIds.length}</b>
              <span>👥 amis</span>
            </button>
            {mine && (
              <button class="pstat" onClick={() => openOverlay({ kind: "stats" })}>
                <b>{stats.value.cooked}</b>
                <span>🔥 cuisinés</span>
              </button>
            )}
          </div>
        )}
        <div class="row" style={{ justifyContent: "center" }}>
          {mine ? (
            <button class="btn" onClick={() => openSheet("profileEdit")}>
              <Icon name="edit" /> Modifier le profil
            </button>
          ) : (
            <RelationButton id={id} />
          )}
        </div>
        {loading && !d ? (
          <div class="skeleton mt" style={{ height: 240 }} />
        ) : d && d.locked ? (
          <Empty icon="🔒" title="Compte privé" text={"Ajoute " + (data?.pseudo || "cette personne") + " en ami pour voir ses plats."} />
        ) : d && d.posts.length ? (
          <>
            <div class="group-title">
              {mine ? "Mes plats" : "Ses plats"} <span class="n">{d.posts.length}</span>
            </div>
            <div class="pgrid">
              {d.posts.map((p) => (
                <button onClick={() => openOverlay({ kind: "post", id: p.id })} aria-label={p.recipe_name || "Publication"}>
                  <img src={p.photo_url!} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <Empty icon="📸" title={mine ? "Aucun plat publié" : "Aucun plat publié"} text={mine ? "Cuisine, prends une photo depuis la fiche du plat, et il apparaîtra ici." : undefined} />
        )}
        {d && !d.locked && d.recipes.length > 0 && (
          <>
            <div class="group-title">
              {mine ? "Mes recettes" : "Ses recettes"} <span class="n">{d.recipes.length}</span>
            </div>
            <div class="list">
              {d.recipes.map((row) => {
                const rd = row.data || {};
                const deja = perso.value.some((x) => x.id === row.id);
                return (
                  <div class="item">
                    <span class="em">{rd.emoji || "🍽️"}</span>
                    <button
                      class="nm"
                      style={{ textAlign: "left" }}
                      onClick={() => {
                        const own = perso.value.find((x) => x.id === row.id);
                        if (own) return openOverlay({ kind: "recipe", id: own.id });
                        const r = sanitizeRecipe({ ...rd, id: row.id, credit: row.author_name || data?.pseudo || "" });
                        if (r) openPreview(r);
                      }}
                    >
                      <b>{rd.nom || "Recette"}</b>
                      <small>{(Array.isArray(rd.ing) ? rd.ing.length : 0) + " ingrédients · " + (rd.cat || "Plat")}</small>
                    </button>
                    {!mine &&
                      (deja ? (
                        <span class="tag ok">✓ Ajoutée</span>
                      ) : (
                        <button
                          class="btn sm"
                          onClick={() => {
                            const r = sanitizeRecipe({ ...rd, id: row.id });
                            if (r && addPersoCopy({ ...r, id: row.id }, row.author_name || data?.pseudo || "")) toast("✅ « " + r.nom + " » ajoutée à tes recettes");
                          }}
                        >
                          <Icon name="plus" /> Ajouter
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function FriendsList({ id, name }: { id: string; name: string }) {
  const [list, setList] = useState<PublicProfile[] | null>(null);
  useEffect(() => {
    void loadProfileData(id).then(async (d) => setList(d ? await loadProfilesByIds(d.friendIds) : []));
  }, [id]);
  return (
    <div class="overlay">
      <div class="ov-inner">
        <Head title={"Amis" + (name ? " de " + name : "")} />
        {!list ? (
          <div class="skeleton" style={{ height: 200 }} />
        ) : list.length ? (
          <div class="list">
            {list.map((p) => (
              <PersonRow p={p}>
                <RelationButton id={p.id} />
              </PersonRow>
            ))}
          </div>
        ) : (
          <Empty icon="👥" title="Aucun ami pour l'instant" />
        )}
      </div>
    </div>
  );
}

export function PostView({ id }: { id: string }) {
  const [p, setP] = useState<Post | null | undefined>(undefined);
  useEffect(() => {
    void loadPost(id).then(setP);
  }, [id]);
  return (
    <div class="overlay">
      <div class="ov-inner" style={{ maxWidth: 600 }}>
        <Head title="Publication" />
        {p === undefined ? (
          <div class="skeleton" style={{ height: 420 }} />
        ) : p && p.id ? (
          <PostCard p={p} expanded onChange={(n) => (n.id ? setP(n) : closeOverlay())} />
        ) : (
          <Empty icon="🗑️" title="Publication introuvable" text="Elle a peut-être été supprimée." />
        )}
      </div>
    </div>
  );
}
export const profileStatsText = () => count(stats.value.cooked, "plat cuisiné", "plats cuisinés");
