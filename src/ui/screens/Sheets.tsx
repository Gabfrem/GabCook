import { useMemo, useState } from "preact/hooks";
import { ingStatus, isPantryStaple } from "../../core/fridge";
import { decodeRecipe, decodeSync, parseIncomingLink } from "../../core/links";
import { cleJour, JOURS_CT, joursAgenda, slotDe, type Meal } from "../../core/planner";
import { sanitizeRecipe, type Recipe } from "../../core/recipe";
import { searchRecipes } from "../../core/search";
import { cap, clean, count } from "../../core/text";
import { qtyLabel } from "../../core/units";
import { resetPassword, signIn, signInWithGoogle, signUp, updatePassword } from "../../services/auth";
import { compressPhoto, IOS, squareThumb, STANDALONE } from "../../services/device";
import { publishPost, pushProfile } from "../../services/social";
import { addMissingToShopping, assignRecipe, cookRecipe, displayName, proposeFor, setSlot } from "../../state/actions";
import { agenda, allRecipes, favorites, findRecipe, fridge, localSet, perso, planned, profile, shopping, user } from "../../state/store";
import { closeSheet, openOverlay, openSheet, setTab, sheet, toast } from "../../state/ui";
import { Cover } from "../components/Cover";
import { Avatar, Sheet } from "../components/common";
import { Icon } from "../components/Icon";
import { BANNERS, bannerStyle } from "./Profile";
import { recommended } from "./lists";
import { titreJour } from "./Week";

const GICON = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
  </svg>
);

function AuthSheet({ welcome }: { welcome?: boolean }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<{ t: string; c: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    localSet("gabcook_seen_welcome", true);
    closeSheet();
  };
  const go = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setMsg({ t: "Entre un e-mail valide.", c: "err" });
    if (mode === "forgot") {
      setBusy(true);
      const e = await resetPassword(email.trim());
      setBusy(false);
      return setMsg(e ? { t: e, c: "err" } : { t: "📧 E-mail envoyé : suis le lien pour choisir un nouveau mot de passe.", c: "ok" });
    }
    if (pass.length < 6) return setMsg({ t: "Le mot de passe doit faire au moins 6 caractères.", c: "err" });
    setBusy(true);
    setMsg({ t: "Connexion en cours…", c: "load" });
    if (mode === "signup") {
      const r = await signUp(email.trim(), pass);
      setBusy(false);
      if (r.error) return setMsg({ t: r.error, c: "err" });
      if (r.needsConfirm) {
        setMode("login");
        return setMsg({ t: "Compte créé ! Confirme ton e-mail (lien reçu), puis connecte-toi.", c: "ok" });
      }
    } else {
      const e = await signIn(email.trim(), pass);
      setBusy(false);
      if (e) return setMsg({ t: e, c: "err" });
    }
    close();
  };
  return (
    <Sheet onClose={close} labelledBy="auth-t">
      {welcome && <img src="/icons/icon-192.png" alt="" width="72" height="72" style={{ borderRadius: 18, margin: "0 auto 12px" }} />}
      <h2 id="auth-t" class={welcome ? "center" : ""}>
        {welcome ? "Bienvenue sur Yummly" : mode === "signup" ? "Créer un compte" : mode === "forgot" ? "Mot de passe oublié" : "Se connecter"}
      </h2>
      <p class={"lead" + (welcome ? " center" : "")}>
        {welcome
          ? "Des centaines de recettes, ton frigo, tes courses et ta semaine. Un compte garde tout en ligne et le retrouve sur tous tes appareils."
          : mode === "forgot"
            ? "On t'envoie un lien pour choisir un nouveau mot de passe."
            : "Ton frigo, tes courses et tes recettes, synchronisés partout."}
      </p>
      {mode !== "forgot" && (
        <>
          <button
            class="btn block"
            onClick={async () => {
              const e = await signInWithGoogle();
              if (e) setMsg({ t: e, c: "err" });
            }}
          >
            {GICON} Continuer avec Google
          </button>
          <div class="sep">ou avec un e-mail</div>
        </>
      )}
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <input class="input" type="email" inputMode="email" autocomplete="email" autocapitalize="off" spellcheck={false} placeholder="Ton e-mail" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
        {mode !== "forgot" && (
          <input
            class="input"
            type="password"
            autocomplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={"Mot de passe" + (mode === "signup" ? " (6 caractères min.)" : "")}
            value={pass}
            onInput={(e) => setPass((e.target as HTMLInputElement).value)}
          />
        )}
        {msg && <div class={"msg " + msg.c}>{msg.t}</div>}
        <button class="btn primary lg" type="submit" disabled={busy}>
          {busy ? "…" : mode === "signup" ? "Créer mon compte" : mode === "forgot" ? "Envoyer le lien" : "Se connecter"}
        </button>
      </form>
      <div class="stack mt" style={{ gap: 4 }}>
        {mode === "login" && (
          <>
            <button class="btn ghost sm" onClick={() => (setMode("signup"), setMsg(null))}>
              Pas encore de compte ? Créer un compte
            </button>
            <button class="btn ghost sm" onClick={() => (setMode("forgot"), setMsg(null))}>
              Mot de passe oublié ?
            </button>
          </>
        )}
        {mode !== "login" && (
          <button class="btn ghost sm" onClick={() => (setMode("login"), setMsg(null))}>
            J'ai déjà un compte · me connecter
          </button>
        )}
        <button class="btn ghost sm muted" onClick={close}>
          {welcome ? "Plus tard, continuer sans compte" : "Annuler"}
        </button>
      </div>
    </Sheet>
  );
}

function NewPasswordSheet() {
  const [p, setP] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <Sheet onClose={closeSheet} labelledBy="np">
      <h2 id="np">Nouveau mot de passe</h2>
      <input class="input mt" type="password" autocomplete="new-password" placeholder="6 caractères minimum" value={p} onInput={(e) => setP((e.target as HTMLInputElement).value)} />
      {msg && <div class="msg err">{msg}</div>}
      <button
        class="btn primary block mt"
        disabled={p.length < 6}
        onClick={async () => {
          const e = await updatePassword(p);
          if (e) return setMsg(e);
          closeSheet();
          toast("✅ Mot de passe mis à jour");
        }}
      >
        Enregistrer
      </button>
    </Sheet>
  );
}

const AVATARS = ["🧑‍🍳", "👩‍🍳", "👨‍🍳", "🍳", "🥘", "🍅", "🥕", "🧀", "🍕", "🍰", "🌶️", "🥑", "🍜", "🐟", "🍗", "☕"];
function ProfileEditSheet() {
  const p = profile.value;
  const [pseudo, setPseudo] = useState(p.pseudo || displayName());
  const [bio, setBio] = useState(p.bio);
  const [priv, setPriv] = useState(p.isPrivate);
  const [avatar, setAvatar] = useState(p.avatar);
  const [err, setErr] = useState("");
  return (
    <Sheet onClose={closeSheet} labelledBy="pe">
      <h2 id="pe">Modifier le profil</h2>
      <div class="center mt">
        <Avatar avatar={avatar} name={pseudo} size="xl" />
      </div>
      <div class="row wrap mt" style={{ justifyContent: "center" }}>
        <label class="btn sm">
          <Icon name="camera" /> Photo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) {
                const d = await squareThumb(f, 192);
                if (d) setAvatar(d);
              }
            }}
          />
        </label>
        {avatar && (
          <button class="btn sm ghost" onClick={() => setAvatar("")}>
            Retirer
          </button>
        )}
      </div>
      <div class="emoji-pick mt" style={{ justifyContent: "center" }}>
        {AVATARS.map((e) => (
          <button class={avatar === e ? "on" : ""} onClick={() => setAvatar(e)}>
            {e}
          </button>
        ))}
      </div>
      <label class="field mt">
        <span>Pseudo</span>
        <input class="input" maxLength={24} value={pseudo} onInput={(e) => setPseudo((e.target as HTMLInputElement).value)} />
      </label>
      <label class="field mt">
        <span>Description</span>
        <textarea class="textarea" maxLength={160} placeholder="Une petite description (facultatif)" value={bio} onInput={(e) => setBio((e.target as HTMLTextAreaElement).value)} />
      </label>
      <div class="label mt">Qui peut voir mon profil ?</div>
      <div class="options">
        <button class={"option" + (!priv ? " on" : "")} onClick={() => setPriv(false)}>
          <span class="ic">🌍</span>
          <span>
            <b>Public</b>
            <small>Tout le monde</small>
          </span>
        </button>
        <button class={"option" + (priv ? " on" : "")} onClick={() => setPriv(true)}>
          <span class="ic">🔒</span>
          <span>
            <b>Privé</b>
            <small>Mes amis seulement</small>
          </span>
        </button>
      </div>
      {err && <div class="msg err">{err}</div>}
      <div class="sheet-actions">
        <button class="btn" onClick={closeSheet}>
          Annuler
        </button>
        <button
          class="btn primary"
          onClick={() => {
            const v = clean(pseudo).slice(0, 24);
            if (!v) return setErr("Choisis un pseudo.");
            profile.value = { ...profile.value, pseudo: v, bio: clean(bio).slice(0, 160), isPrivate: priv, avatar };
            void pushProfile();
            closeSheet();
            toast("✅ Profil mis à jour");
          }}
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function BannerSheet() {
  const p = profile.value;
  const [b, setB] = useState(p.banner || "preset:camel");
  const [pos, setPos] = useState(p.bannerPos == null ? 50 : p.bannerPos);
  const isPhoto = b.startsWith("data:") || b.startsWith("http");
  return (
    <Sheet onClose={closeSheet} labelledBy="bn">
      <h2 id="bn">Ta bannière</h2>
      <div class="pbanner mt" style={bannerStyle(b, pos)} />
      {isPhoto && <input type="range" min="0" max="100" value={pos} aria-label="Cadrage" style={{ width: "100%", accentColor: "var(--accent)" }} onInput={(e) => setPos(+(e.target as HTMLInputElement).value)} />}
      <label class="btn block mt">
        🖼️ Choisir une photo
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            const c = await compressPhoto(f, 900, 0.78);
            if (c) setB(c.dataUrl);
          }}
        />
      </label>
      <div class="sep">ou une couleur</div>
      <div class="emoji-pick" style={{ justifyContent: "center" }}>
        {Object.keys(BANNERS).map((id) => (
          <button class={b === "preset:" + id ? "on" : ""} style={{ background: BANNERS[id] }} aria-label={id} onClick={() => setB("preset:" + id)} />
        ))}
      </div>
      <div class="sheet-actions">
        <button class="btn" onClick={closeSheet}>
          Annuler
        </button>
        <button
          class="btn primary"
          onClick={() => {
            profile.value = { ...profile.value, banner: b, bannerPos: pos };
            void pushProfile();
            closeSheet();
          }}
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function PostSheet({ id }: { id: string }) {
  const r = findRecipe(id);
  const [photo, setPhoto] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [desc, setDesc] = useState("");
  const [vis, setVis] = useState<"public" | "friends">("public");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!r) return null;
  return (
    <Sheet onClose={closeSheet} labelledBy="ps">
      <h2 id="ps">Partager ce plat</h2>
      <p class="lead">
        {r.emoji} {r.nom}
      </p>
      <label class="photo-drop">
        {photo ? <img src={photo.dataUrl} alt="" /> : <span>📷 Prendre ou choisir une photo</span>}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) setPhoto(await compressPhoto(f, 1080, 0.82));
          }}
        />
      </label>
      <textarea class="textarea mt" placeholder="Un mot sur ton plat… (facultatif)" maxLength={500} value={desc} onInput={(e) => setDesc((e.target as HTMLTextAreaElement).value)} />
      <div class="options">
        <button class={"option" + (vis === "public" ? " on" : "")} onClick={() => setVis("public")}>
          <span class="ic">🌍</span>
          <span>
            <b>Public</b>
            <small>Tout le monde · illustre la recette pour la communauté</small>
          </span>
        </button>
        <button class={"option" + (vis === "friends" ? " on" : "")} onClick={() => setVis("friends")}>
          <span class="ic">👥</span>
          <span>
            <b>Amis</b>
            <small>Tes amis seulement</small>
          </span>
        </button>
      </div>
      {err && <div class="msg err">{err}</div>}
      <div class="sheet-actions">
        <button class="btn" onClick={closeSheet}>
          Plus tard
        </button>
        <button
          class="btn primary"
          disabled={!photo || busy}
          onClick={async () => {
            if (!photo) return;
            setBusy(true);
            const e = await publishPost({ recipeId: r.id, recipeName: r.nom, emoji: r.emoji, blob: photo.blob, description: desc, visibility: vis });
            setBusy(false);
            if (e) return setErr(e);
            closeSheet();
            toast("✅ Plat publié !");
          }}
        >
          {busy ? "Publication…" : "Publier"}
        </button>
      </div>
    </Sheet>
  );
}

function ImportSheet({ recipe, sync }: { recipe?: Recipe; sync?: ReturnType<typeof decodeSync> }) {
  const horsApp = IOS && !STANDALONE;
  return (
    <Sheet onClose={closeSheet} labelledBy="imp">
      <h2 id="imp">{recipe ? "Ajouter cette recette ?" : "Récupérer ce frigo ?"}</h2>
      <p class="lead">
        {recipe
          ? "« " + recipe.nom + " » — " + count(recipe.ing.length, "ingrédient") + ", " + count(recipe.etapes.length, "étape") + ". Elle rejoindra tes recettes."
          : "Ce lien contient " + count(sync!.fridge.length, "produit") + " et " + count(sync!.shopping.length, "article") + " de courses. Ils remplaceront ceux de cet appareil."}
      </p>
      {horsApp && (
        <div class="msg load">
          ⚠️ Tu es dans Safari, pas dans l'application de ton écran d'accueil : sur iPhone, les deux ne partagent pas leurs données. Copie ce lien, ouvre Yummly depuis l'écran d'accueil, puis Réglages → Importer un lien reçu.
        </div>
      )}
      <div class="sheet-actions">
        <button class="btn" onClick={closeSheet}>
          Annuler
        </button>
        <button
          class="btn primary"
          onClick={() => {
            closeSheet();
            if (recipe) {
              const r = sanitizeRecipe({ ...recipe, id: "perso-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) })!;
              perso.value = [...perso.value, r];
              toast("✅ « " + r.nom + " » ajoutée à tes recettes");
              openOverlay({ kind: "recipe", id: r.id });
            } else if (sync) {
              fridge.value = sync.fridge;
              shopping.value = sync.shopping.map((s, i) => ({ id: i + 1, ...s }));
              setTab("fridge");
              toast("🧊 Frigo et courses récupérés");
            }
          }}
        >
          {recipe ? "Ajouter" : "Récupérer"}
        </button>
      </div>
    </Sheet>
  );
}

function PasteSheet() {
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState(false);
  return (
    <Sheet onClose={closeSheet} labelledBy="pst">
      <h2 id="pst">Importer un lien reçu</h2>
      <p class="lead">Colle le lien qu'on t'a envoyé : une recette ou un frigo.</p>
      <textarea class="textarea" placeholder="https://yummly.fr/?rp=…" autocapitalize="off" spellcheck={false} value={txt} onInput={(e) => (setTxt((e.target as HTMLTextAreaElement).value), setErr(false))} />
      {err && <div class="msg err">Ce lien n'a pas été reconnu. Vérifie que tu as copié l'adresse entière.</div>}
      <div class="sheet-actions">
        <button class="btn" onClick={closeSheet}>
          Annuler
        </button>
        <button
          class="btn primary"
          disabled={!txt.trim()}
          onClick={() => {
            const l = parseIncomingLink(txt);
            const rec = decodeRecipe(l.rp);
            if (rec) return openSheet("import", { recipe: rec });
            const sy = decodeSync(l.sync);
            if (sy) return openSheet("import", { sync: sy });
            if (l.r && findRecipe(l.r)) {
              closeSheet();
              return openOverlay({ kind: "recipe", id: l.r });
            }
            setErr(true);
          }}
        >
          Importer
        </button>
      </div>
    </Sheet>
  );
}

function PlanSheet({ id }: { id: string }) {
  const r = findRecipe(id);
  const jours = joursAgenda();
  const [day, setDay] = useState(cleJour(jours[new Date().getHours() >= 20 ? 1 : 0]));
  if (!r) return null;
  const iDay = jours.findIndex((d) => cleJour(d) === day);
  return (
    <Sheet onClose={closeSheet} labelledBy="pl">
      <h2 id="pl">Planifier</h2>
      <p class="lead">
        {r.emoji} {r.nom}
      </p>
      <div class="days" style={{ margin: 0, padding: 0 }}>
        {jours.map((d, i) => (
          <button class={"day" + (cleJour(d) === day ? " on" : "")} onClick={() => setDay(cleJour(d))}>
            <small>{i === 0 ? "auj." : JOURS_CT[d.getDay()]}</small>
            <b>{d.getDate()}</b>
          </button>
        ))}
      </div>
      <p class="small muted mt">{titreJour(jours[iDay], iDay)}</p>
      <div class="sheet-actions" style={{ marginTop: 10 }}>
        {(["midi", "soir"] as Meal[]).map((m) => {
          const s = slotDe(agenda.value, day, m);
          const occ = s ? (s.t === "restes" ? "les restes" : findRecipe(s.id)?.nom || "") : "";
          return (
            <button
              class="btn primary"
              style={{ flexDirection: "column", minHeight: 64 }}
              onClick={() => {
                assignRecipe(id, day, m);
                closeSheet();
                toast("🗓️ Planifié " + titreJour(jours[iDay], iDay).toLowerCase() + ", " + m, { label: "Voir", run: () => setTab("week") });
              }}
            >
              {m === "midi" ? "☀️ Midi" : "🌙 Soir"}
              {occ && <small style={{ fontWeight: 500, opacity: 0.8 }}>remplace : {occ}</small>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function SlotSheet({ cle, repas }: { cle: string; repas: Meal }) {
  const [q, setQ] = useState("");
  const jours = joursAgenda();
  const i = jours.findIndex((d) => cleJour(d) === cle);
  const list = useMemo(() => {
    const all = allRecipes.value.filter((r) => r.cat === "Plat" || r.cat === "Entrée" || r.cat === "Accompagnement");
    if (q.trim()) return searchRecipes(all, q).slice(0, 30);
    const pinned = [...planned.value, ...favorites.value].map((x) => findRecipe(x)).filter((r): r is Recipe => !!r && r.cat === "Plat");
    const seen = new Set<string>();
    return [...pinned, ...recommended(16)].filter((r) => !seen.has(r.id) && seen.add(r.id)).slice(0, 24);
  }, [q]);
  return (
    <Sheet onClose={closeSheet} labelledBy="sl">
      <h2 id="sl">
        {i >= 0 ? titreJour(jours[i], i) : cle} · {repas}
      </h2>
      <div class="options mt">
        <button
          class="option"
          onClick={() => {
            const r = proposeFor(cle, repas);
            closeSheet();
            if (r) toast("✨ " + r.nom, { label: "Autre idée", run: () => proposeFor(cle, repas) });
          }}
        >
          <span class="ic">✨</span>
          <span>
            <b>Me proposer un plat</b>
            <small>Selon mes goûts et mon matériel</small>
          </span>
        </button>
        <button
          class="option"
          onClick={() => {
            setSlot(cle, repas, { t: "restes" });
            closeSheet();
          }}
        >
          <span class="ic">♻️</span>
          <span>
            <b>Les restes</b>
            <small>Rien à cuisiner pour ce repas</small>
          </span>
        </button>
      </div>
      <div class="group-title">Choisir une recette</div>
      <div class="searchbar">
        <Icon name="search" class="lead" />
        <input class="input" type="search" placeholder="Rechercher…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </div>
      <div class="list mt-s">
        {list.map((r) => (
          <button
            class="item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => {
              assignRecipe(r.id, cle, repas);
              closeSheet();
            }}
          >
            <Cover r={r} class="em" />
            <span class="nm">
              <b>{r.nom}</b>
              <small>
                {r.prep + r.cuisson} min · {r.diff}
              </small>
            </span>
            <Icon name="plus" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function CookedSheet({ id, portions, fromCook }: { id: string; portions: number; fromCook?: boolean }) {
  const r = findRecipe(id);
  if (!r) return null;
  const factor = portions / (r.portions || 1);
  const f = fridge.value;
  const missing = f.length ? r.ing.filter((i) => ingStatus(f, i, factor).s !== "have" && !isPantryStaple(i.n)) : [];
  const done = () => {
    cookRecipe(r, portions);
    closeSheet();
    if (user.value) setTimeout(() => openSheet("post", { id: r.id }), 350);
  };
  return (
    <Sheet onClose={closeSheet} labelledBy="ck">
      <h2 id="ck">{fromCook ? "👨‍🍳 Bon appétit !" : "Tu as cuisiné ce plat ?"}</h2>
      <p class="lead">
        {f.length
          ? "Yummly retire de ton frigo ce que tu as utilisé pour " + count(portions, "personne") + "."
          : "On l'ajoute à tes statistiques. Remplis ton frigo pour que les quantités soient aussi décomptées."}
      </p>
      {missing.length > 0 && (
        <div class="panel warn">
          <b>⚠️ Il manquait {count(missing.length, "ingrédient")}</b>
          <div class="small mt-s">{missing.map((i) => cap(i.n) + (i.q != null ? " (" + qtyLabel(i, factor) + ")" : "")).join(", ")}</div>
          <p class="hint">Le frigo n'est débité que de ce qu'il contient vraiment.</p>
        </div>
      )}
      <div class="stack mt">
        <button class="btn primary lg" onClick={done}>
          ✅ Oui, mettre à jour mon frigo
        </button>
        {missing.length > 0 && (
          <button
            class="btn"
            onClick={() => {
              addMissingToShopping(r, portions);
              closeSheet();
            }}
          >
            🛒 Pas encore : ajouter les manquants aux courses
          </button>
        )}
        <button class="btn ghost" onClick={closeSheet}>
          Annuler
        </button>
      </div>
    </Sheet>
  );
}

export function Sheets() {
  const s = sheet.value;
  if (!s) return null;
  const d = s.data || {};
  switch (s.kind) {
    case "auth":
      return <AuthSheet welcome={d.welcome} />;
    case "newPassword":
      return <NewPasswordSheet />;
    case "profileEdit":
      return <ProfileEditSheet />;
    case "banner":
      return <BannerSheet />;
    case "post":
      return <PostSheet id={d.id} />;
    case "import":
      return <ImportSheet recipe={d.recipe} sync={d.sync} />;
    case "paste":
      return <PasteSheet />;
    case "plan":
      return <PlanSheet id={d.id} />;
    case "slot":
      return <SlotSheet cle={d.cle} repas={d.repas} />;
    case "cooked":
      return <CookedSheet id={d.id} portions={d.portions} fromCook={d.fromCook} />;
    default:
      return null;
  }
}
