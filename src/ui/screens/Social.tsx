import { useEffect, useState } from "preact/hooks";
import { timeAgo } from "../../core/text";
import {
  acceptFriend,
  addComment,
  addFriend,
  deleteComment,
  deletePost,
  feed,
  feedState,
  friends,
  incoming,
  loadFeed,
  loadSocial,
  outgoing,
  relationWith,
  removeFriend,
  searchProfiles,
  socialLoaded,
  toggleLike,
  type Post,
  type PublicProfile
} from "../../services/social";
import { findRecipe, isAdmin, user } from "../../state/store";
import { openOverlay, openSheet } from "../../state/ui";
import { Avatar, confirmDelete, Empty, openRecipe, useDebounced } from "../components/common";
import { Icon } from "../components/Icon";

export function PostCard({ p, onChange, expanded }: { p: Post; onChange?: (p: Post) => void; expanded?: boolean }) {
  const [open, setOpen] = useState(!!expanded);
  const [draft, setDraft] = useState("");
  const me = user.value;
  const canDel = !!me && (p.author === me.id || isAdmin.value);
  const set = (n: Post) => onChange && onChange(n);
  const r = p.recipe_id ? findRecipe(p.recipe_id) : null;
  return (
    <article class="post">
      <button class="post-head" style={{ width: "100%", textAlign: "left" }} onClick={() => openOverlay({ kind: "profile", id: p.author })}>
        <Avatar avatar={p.prof.avatar} name={p.prof.pseudo} size="sm" />
        <span class="grow">
          <b>{p.prof.pseudo || "?"}</b>
          <small>{timeAgo(p.created_at)}</small>
        </span>
        <span class="tag">{p.visibility === "friends" ? "👥 Amis" : "🌍 Public"}</span>
      </button>
      {p.photo_url && <img class="ph" src={p.photo_url} alt={p.recipe_name || "Photo du plat"} loading="lazy" />}
      <div class="post-body">
        {p.recipe_name &&
          (r ? (
            <button class="tag accent" style={{ alignSelf: "flex-start" }} onClick={() => openRecipe(r.id)}>
              {p.emoji || "🍽️"} {p.recipe_name} · voir la recette ›
            </button>
          ) : (
            <span class="tag" style={{ alignSelf: "flex-start" }}>
              {p.emoji || "🍽️"} {p.recipe_name}
            </span>
          ))}
        {p.description && <p>{p.description}</p>}
      </div>
      <div class="post-acts">
        <button class={p.liked ? "liked" : ""} aria-pressed={p.liked} aria-label="J'aime" onClick={async () => set(await toggleLike(p))}>
          <Icon name="heart" fill={p.liked} /> {p.likeCount || ""}
        </button>
        <button aria-expanded={open} aria-label="Commentaires" onClick={() => setOpen(!open)}>
          <Icon name="comment" /> {p.comments.length || ""}
        </button>
        <div class="grow" />
        {canDel && (
          <button
            aria-label="Supprimer la publication"
            onClick={() =>
              confirmDelete("Supprimer cette publication ?", "La photo et ses commentaires seront effacés.", async () => {
                await deletePost(p);
                set({ ...p, id: "" });
              })
            }
          >
            <Icon name="trash" />
          </button>
        )}
      </div>
      {open && (
        <div class="comments">
          {p.comments.length === 0 && <span class="small muted">Sois le premier à commenter.</span>}
          {p.comments.map((c) => {
            const mine = !!me && (c.user_id === me.id || p.author === me.id || isAdmin.value);
            return (
              <div class="comment">
                <button onClick={() => openOverlay({ kind: "profile", id: c.user_id })} aria-label={"Profil de " + c.prof.pseudo}>
                  <Avatar avatar={c.prof.avatar} name={c.prof.pseudo} size="sm" />
                </button>
                <div class="bubble">
                  <b>{c.prof.pseudo}</b> {c.text}
                </div>
                {mine && (
                  <button class="del" aria-label="Supprimer le commentaire" onClick={async () => set(await deleteComment(p, c.id))}>
                    <Icon name="close" />
                  </button>
                )}
              </div>
            );
          })}
          <form
            class="row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              const n = await addComment(p, draft);
              setDraft("");
              set(n);
            }}
          >
            <input class="input" placeholder="Ajouter un commentaire…" value={draft} maxLength={500} onInput={(e) => setDraft((e.target as HTMLInputElement).value)} />
            <button class="btn primary" type="submit" disabled={!draft.trim()}>
              Envoyer
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export function PersonRow({ p, children }: { p: PublicProfile; children?: any }) {
  return (
    <div class="person">
      <button onClick={() => openOverlay({ kind: "profile", id: p.id })} aria-label={"Profil de " + p.pseudo}>
        <Avatar avatar={p.avatar} name={p.pseudo} size="sm" />
      </button>
      <button class="nm" onClick={() => openOverlay({ kind: "profile", id: p.id })}>
        {p.pseudo || "?"}
      </button>
      {children}
    </div>
  );
}

export function RelationButton({ id }: { id: string }) {
  const rel = relationWith(id);
  if (rel === "self") return null;
  if (rel === "friend")
    return (
      <button class="btn sm" onClick={() => removeFriend(id)}>
        ✓ Amis
      </button>
    );
  if (rel === "outgoing")
    return (
      <button class="btn sm" onClick={() => removeFriend(id)}>
        Annuler la demande
      </button>
    );
  if (rel === "incoming")
    return (
      <button class="btn sm primary" onClick={() => acceptFriend(id)}>
        Accepter
      </button>
    );
  return (
    <button class="btn sm primary" onClick={() => addFriend(id)}>
      <Icon name="plus" /> Ajouter
    </button>
  );
}

function Friends() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [res, setRes] = useState<PublicProfile[] | null>(null);
  useEffect(() => {
    if (dq.trim().length < 2) return setRes(null);
    let alive = true;
    void searchProfiles(dq).then((r) => alive && setRes(r));
    return () => {
      alive = false;
    };
  }, [dq]);
  return (
    <div>
      <div class="searchbar">
        <Icon name="search" class="lead" />
        <input class="input" type="search" placeholder="Rechercher un pseudo…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </div>
      {res && (
        <>
          <div class="group-title">Résultats</div>
          {res.length ? (
            <div class="list">
              {res.map((p) => (
                <PersonRow p={p}>
                  <RelationButton id={p.id} />
                </PersonRow>
              ))}
            </div>
          ) : (
            <p class="small muted">Aucun pseudo ne correspond. Ton ami doit avoir créé un compte.</p>
          )}
        </>
      )}
      {incoming.value.length > 0 && (
        <>
          <div class="group-title">
            Demandes reçues <span class="n">{incoming.value.length}</span>
          </div>
          <div class="list">
            {incoming.value.map((p) => (
              <PersonRow p={p}>
                <button class="btn sm primary" onClick={() => acceptFriend(p.id)}>
                  Accepter
                </button>
                <button class="del" aria-label="Refuser" onClick={() => removeFriend(p.id)}>
                  <Icon name="close" />
                </button>
              </PersonRow>
            ))}
          </div>
        </>
      )}
      <div class="group-title">
        Mes amis <span class="n">{friends.value.length}</span>
      </div>
      {friends.value.length ? (
        <div class="list">
          {friends.value.map((p) => (
            <PersonRow p={p}>
              <button class="btn sm" onClick={() => confirmDelete("Retirer " + p.pseudo + " de tes amis ?", "Vous ne verrez plus vos publications réservées aux amis.", () => removeFriend(p.id))}>
                Retirer
              </button>
            </PersonRow>
          ))}
        </div>
      ) : (
        <p class="small muted">Pas encore d'amis : cherche un pseudo ci-dessus.</p>
      )}
      {outgoing.value.length > 0 && (
        <>
          <div class="group-title">Demandes envoyées</div>
          <div class="list">
            {outgoing.value.map((p) => (
              <PersonRow p={p}>
                <span class="tag">En attente</span>
                <button class="del" aria-label="Annuler" onClick={() => removeFriend(p.id)}>
                  <Icon name="close" />
                </button>
              </PersonRow>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Social() {
  const [sub, setSub] = useState<"feed" | "friends">("feed");
  const u = user.value;
  useEffect(() => {
    if (!u) return;
    if (!socialLoaded.value) void loadSocial();
    if (feedState.value === "idle") void loadFeed();
  }, [u && u.id]);
  if (!u)
    return (
      <div>
        <header class="topbar">
          <h1 class="screen-title">Social</h1>
        </header>
        <Empty icon="👥" title="Cuisine avec tes amis" text="Connecte-toi pour partager tes plats en photo, suivre tes amis et échanger vos recettes.">
          <button class="btn primary" onClick={() => openSheet("auth")}>
            Se connecter
          </button>
        </Empty>
      </div>
    );
  return (
    <div>
      <header class="topbar">
        <h1 class="screen-title grow">Social</h1>
        <button class="iconbtn" aria-label="Actualiser" onClick={() => void loadFeed()}>
          <Icon name="recycle" />
        </button>
        <button class="iconbtn" aria-label="Mon profil" onClick={() => openOverlay({ kind: "profile", id: u.id })}>
          <Icon name="user" />
        </button>
      </header>
      <div class="seg" role="tablist" style={{ marginBottom: 16 }}>
        <button role="tab" aria-selected={sub === "feed"} class={sub === "feed" ? "on" : ""} onClick={() => setSub("feed")}>
          🍽️ Fil
        </button>
        <button role="tab" aria-selected={sub === "friends"} class={sub === "friends" ? "on" : ""} onClick={() => setSub("friends")}>
          👥 Amis{incoming.value.length ? " · " + incoming.value.length : ""}
        </button>
      </div>
      {sub === "feed" ? (
        feedState.value === "loading" && !feed.value.length ? (
          <div class="stack">
            <div class="skeleton" style={{ height: 380 }} />
            <div class="skeleton" style={{ height: 380 }} />
          </div>
        ) : feedState.value === "error" ? (
          <Empty icon="📡" title="Fil indisponible" text="Vérifie ta connexion puis réessaie.">
            <button class="btn" onClick={() => void loadFeed()}>
              Réessayer
            </button>
          </Empty>
        ) : feed.value.length ? (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            {feed.value.map((p) => (
              <PostCard p={p} key={p.id} />
            ))}
          </div>
        ) : (
          <Empty icon="📸" title="Le fil est vide pour l'instant" text="Cuisine un plat, prends-le en photo depuis sa fiche (« Partager une photo de mon plat »), et il apparaîtra ici." />
        )
      ) : (
        <Friends />
      )}
    </div>
  );
}
