import { useEffect, useState } from "preact/hooks";
import { emojiOf } from "../../core/catalog";
import { cuisineDe, cuisineInfo, isVege } from "../../core/classify";
import { fmtDuree } from "../../core/cooking";
import { ingStatus, isPantryStaple } from "../../core/fridge";
import { encodeRecipe } from "../../core/links";
import { ENSEIGNES, euros, prixRecette } from "../../core/pricing";
import { needsOven, type Recipe } from "../../core/recipe";
import { isDeSaison, seasonOf } from "../../core/seasons";
import { substitutsDe } from "../../core/substitutions";
import { cap, count, timeAgo } from "../../core/text";
import { fmtNum, fromBase, qtyLabel } from "../../core/units";
import { shareOrCopy } from "../../services/device";
import {
  addMissingToShopping,
  addPersoCopy,
  deletePersoRecipe,
  globalRating,
  isPlanned,
  lastCooked,
  myRating,
  rateRecipe,
  setNote,
  timesCooked,
  togglePlanned
} from "../../state/actions";
import { AF, communityPhotos, cookMode, findRecipe, fridge, notes, settings, shopping, user } from "../../state/store";
import { closeOverlay, openOverlay, openSheet, replaceTop, toast, type Overlay } from "../../state/ui";
import { Cover } from "../components/Cover";
import { confirmDelete, FavButton, Stepper, viewFor } from "../components/common";
import { Icon } from "../components/Icon";
import { ingKey } from "../../core/ingredients";

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "le web";
  }
};

function RatingInput({ id }: { id: string }) {
  const mine = myRating(id);
  const g = globalRating(id);
  return (
    <div class="row wrap mt" style={{ gap: 12 }}>
      <div class="stars-input" role="radiogroup" aria-label="Ma note">
        {[1, 2, 3, 4, 5].map((i) => (
          <button class={i <= mine ? "on" : ""} aria-label={i + " étoile" + (i > 1 ? "s" : "")} aria-checked={i === mine} role="radio" onClick={() => rateRecipe(id, i)}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
            </svg>
          </button>
        ))}
      </div>
      <span class="small muted">
        {mine ? "Ta note : " + mine + "/5" : "Note cette recette"}
        {g.n > 0 && " · moyenne " + g.moy.toFixed(1).replace(".", ",") + " (" + count(g.n, "vote") + ")"}
      </span>
    </div>
  );
}

function NoteBox({ id }: { id: string }) {
  const [txt, setTxt] = useState(notes.value[id] || "");
  const [state, setState] = useState<"" | "…" | "✓">("");
  useEffect(() => {
    if (txt === (notes.value[id] || "")) return;
    setState("…");
    const t = setTimeout(() => {
      setNote(id, txt);
      setState("✓");
    }, 600);
    return () => clearTimeout(t);
  }, [txt]);
  return (
    <div class="panel mt-l">
      <div class="row" style={{ justifyContent: "space-between" }}>
        <b>📝 Ma note</b>
        <span class="small muted">{state === "✓" ? "enregistrée" : state === "…" ? "…" : ""}</span>
      </div>
      <textarea
        class="textarea note-area mt-s"
        maxLength={1200}
        value={txt}
        placeholder="Un rappel pour la prochaine fois : moins de sel, cuisson plus courte, la version que tout le monde préfère…"
        onInput={(e) => setTxt((e.target as HTMLTextAreaElement).value)}
      />
      <p class="hint">Visible seulement par toi.</p>
    </div>
  );
}

function PriceBlock({ r, portions }: { r: Recipe; portions: number }) {
  const p = prixRecette(r);
  if (!p.total) return null;
  const facteur = portions / (r.portions || 1);
  const lignes = ENSEIGNES.map(([nom, idx]) => ({ nom, t: p.total * idx * facteur }));
  const mini = Math.min(...lignes.map((l) => l.t)),
    maxi = Math.max(...lignes.map((l) => l.t));
  return (
    <div class="panel mt">
      <div class="row" style={{ justifyContent: "space-between" }}>
        <b>💶 Combien ça coûte ?</b>
        <span>
          <b style={{ fontFamily: "var(--display)", fontSize: 20 }}>≈ {euros(p.parPers)}</b>
          <span class="small muted"> /pers.</span>
        </span>
      </div>
      <p class="small muted mt-s">
        Environ <b>{euros(p.total * facteur)}</b> pour {count(portions, "personne")}, selon l'enseigne :
      </p>
      <div class="pricebars">
        {lignes.map((l) => (
          <div class={"pricebar" + (l.t === mini ? " best" : "")}>
            <span>{l.nom}</span>
            <i style={{ width: Math.round((l.t / maxi) * 100) + "%" }} />
            <span class="v">{euros(l.t)}</span>
          </div>
        ))}
      </div>
      <p class="hint">Estimation à partir de prix moyens constatés en France et d'un indice de cherté par enseigne : un ordre de grandeur, pas un relevé.</p>
    </div>
  );
}

function IngredientRow({ i, factor, showStatus }: { i: Recipe["ing"][number]; factor: number; showStatus: boolean }) {
  const [open, setOpen] = useState(false);
  const st0 = ingStatus(fridge.value, i, factor);
  const staple = st0.s !== "have" && isPantryStaple(i.n);
  const st = staple ? { ...st0, s: "staple" as const } : st0;
  const enListe = shopping.value.some((s) => ingKey(s.base) === ingKey(i.n));
  const subs = st.s === "missing" || st.s === "low" ? substitutsDe(i.n) : [];
  let hint = "";
  if (showStatus) {
    if (st.s === "low" && st.f && st.short != null) hint = "il en manque " + fmtNum(Math.round(fromBase(st.short, st.f.u) * 100) / 100) + (st.f.u ? " " + st.f.u : "");
    else if (st.s === "have" && st.parFamille && st.f) hint = "tu as « " + cap(st.f.n) + " »";
    else if (st.s === "missing" && enListe) hint = "dans ta liste de courses";
    else if (st.s === "staple") hint = "de base : sûrement dans ton placard";
  }
  return (
    <li>
      {showStatus && (
        <span class={"st " + st.s} aria-label={st.s === "have" ? "dans ton frigo" : st.s === "low" ? "quantité insuffisante" : st.s === "staple" ? "produit de base" : "manquant"}>
          {st.s === "have" ? "✓" : st.s === "low" ? "!" : st.s === "staple" ? "•" : ""}
        </span>
      )}
      <span class="em" aria-hidden="true">
        {emojiOf(i.n)}
      </span>
      <span class="nm">
        {cap(i.n)}
        {hint && <small>{hint}</small>}
        {subs.length > 0 && (
          <button class="subs" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Masquer" : "Par quoi le remplacer ?"}
          </button>
        )}
        {open && (
          <small style={{ color: "var(--ink-2)" }}>
            {subs.map((s) => (
              <div>• {s}</div>
            ))}
          </small>
        )}
      </span>
      <span class="q">{qtyLabel(i, factor)}</span>
    </li>
  );
}

export function RecipeDetail({ o }: { o: Extract<Overlay, { kind: "recipe" }> }) {
  const r = findRecipe(o.id) || (o.preview ? previews[o.id] : null);
  const [portions, setPortions] = useState<number>(o.portions || (r ? (settings.value.personnes || r.portions) : 4));
  const [done, setDone] = useState<Record<number, boolean>>({});
  useEffect(() => {
    const el = document.querySelector(".overlay:last-of-type");
    if (el) el.scrollTop = 0;
  }, [o.id]);
  if (!r)
    return (
      <div class="overlay">
        <div class="ov-inner">
          <div class="ov-head">
            <button class="iconbtn" aria-label="Retour" onClick={closeOverlay}>
              <Icon name="back" />
            </button>
          </div>
          <p class="empty">Cette recette n'existe plus.</p>
        </div>
      </div>
    );
  const v = viewFor(r);
  const factor = portions / (r.portions || 1);
  const f = fridge.value;
  const statuses = r.ing.map((i) => ingStatus(f, i, factor));
  const missing = r.ing.filter((i, k) => statuses[k].s !== "have" && !isPantryStaple(i.n)).length;
  const cui = cuisineInfo(cuisineDe(r));
  const saison = isDeSaison(r);
  const nb = timesCooked(r.id);
  const last = lastCooked(r.id);
  const com = (communityPhotos.value[r.id] || []).filter((p) => p.url !== r.photo);
  const preview = !!o.preview;
  const share = async () => {
    const url = location.origin + "/" + (r.perso ? "?rp=" + encodeRecipe(r) : "?r=" + encodeURIComponent(r.id) + (portions !== r.portions ? "&p=" + portions : ""));
    if (url.length > 7000) return toast("Recette trop longue pour tenir dans un lien");
    const res = await shareOrCopy({ title: r.emoji + " " + r.nom, text: "Une recette Yummly pour toi : " + r.nom, url });
    if (res === "copied") toast("📋 Lien copié — colle-le dans un message");
    else if (res === "failed") toast("Partage impossible sur cet appareil");
  };
  const steps = v.etapes;
  return (
    <div class="overlay" role="dialog" aria-label={r.nom}>
      <div class="ov-inner">
        <div class="rhero">
          <Cover r={r} small={false} />
          <div class="bar">
            <button class="iconbtn glass" aria-label="Retour" onClick={closeOverlay}>
              <Icon name="back" />
            </button>
            <div class="grow" />
            {!preview && <FavButton id={r.id} class="iconbtn glass" />}
            <button class="iconbtn glass" aria-label="Partager" onClick={share}>
              <Icon name="share" />
            </button>
            <button class="iconbtn glass" aria-label="Imprimer" onClick={() => print()}>
              <Icon name="printer" />
            </button>
          </div>
          {r.photo && /themealdb/.test(r.photo) && <span class="credit">Photo : TheMealDB</span>}
        </div>
        <div class="rsheet">
          <div class="rkicker">
            {r.cat} · {cui.emoji} {cui.nom}
            {isVege(r) ? " · 🌱 Végétarien" : ""}
          </div>
          <h1 class="rtitle">{r.nom}</h1>
          {r.credit && <p class="small muted mt-s">👤 Recette de {r.credit}</p>}
          {r.srcUrl && (
            <p class="small muted mt-s">
              Importée depuis{" "}
              <a href={r.srcUrl} target="_blank" rel="noopener noreferrer">
                {hostOf(r.srcUrl)}
              </a>
            </p>
          )}
          {!preview && <RatingInput id={r.id} />}
          <div class="row wrap mt-s" style={{ gap: 6 }}>
            {saison && <span class="tag ok">🍂 De saison</span>}
            {isPlanned(r.id) && (
              <button class="tag accent" onClick={() => togglePlanned(r.id)}>
                📌 À réaliser ✕
              </button>
            )}
            {nb > 0 && (
              <span class="tag">
                🔥 Cuisiné {nb} fois{last ? " · " + timeAgo(last) : ""}
              </span>
            )}
          </div>
          <div class="facts">
            <div class="fact">
              <b>{fmtDuree(r.prep)}</b>
              <small>Préparation</small>
            </div>
            <div class="fact">
              <b>{fmtDuree(v.cuisson)}</b>
              <small>{v.af ? "Air fryer" : v.mo ? "Micro-ondes" : "Cuisson"}</small>
            </div>
            <div class="fact">
              <b>{r.diff}</b>
              <small>Difficulté</small>
            </div>
            <div class="fact">
              <b>{euros(prixRecette(r).parPers).replace(",00", "")}</b>
              <small>par pers.</small>
            </div>
          </div>
          {v.af && (
            <div class="callout">
              <span class="ic">🍟</span>
              <div>
                <b>
                  Version air fryer : {v.af.t}°C · {v.af.min} min
                </b>
                {needsOven(r, AF.value) ? "Au lieu du four. " : "Au lieu de la friture ou de la poêle. "}
                {v.af.tip}
              </div>
            </div>
          )}
          {v.mo && (
            <div class="callout">
              <span class="ic">🔆</span>
              <div>
                <b>
                  Version micro-ondes : {v.mo.w} · {v.mo.min} min
                </b>
                {v.mo.tip}
              </div>
            </div>
          )}
          {cookMode.value === "airfryer" && AF.value[r.id] && AF.value[r.id].ko && (
            <div class="callout ko">
              <span class="ic">🚫</span>
              <div>
                <b>Pas d'équivalent air fryer</b>
                {AF.value[r.id].ko} La version au four est affichée ci-dessous.
              </div>
            </div>
          )}
          {seasonOf(r).dehors.length > 0 && !saison && (
            <p class="hint">Hors saison en ce moment : {seasonOf(r).dehors.map((x) => cap(x)).join(", ")}.</p>
          )}

          <div class="section-head mt-l">
            <h2>Ingrédients</h2>
            <Stepper value={portions} min={1} max={50} onChange={setPortions} label={(n) => n + " pers."} />
          </div>
          {f.length > 0 && (
            <p class="small muted" style={{ margin: "-4px 0 10px" }}>
              {missing === 0 ? "✓ Tu as tout dans ton frigo." : "Il te manque " + count(missing, "ingrédient") + "."}
            </p>
          )}
          <ul class="ings">
            {r.ing.map((i) => (
              <IngredientRow i={i} factor={factor} showStatus={f.length > 0} />
            ))}
          </ul>

          {preview ? (
            <div class="actions-grid">
              <button
                class="btn primary lg"
                onClick={() => {
                  const c = addPersoCopy(r, r.credit);
                  if (c) {
                    toast("✅ « " + c.nom + " » ajoutée à tes recettes");
                    replaceTop({ kind: "recipe", id: c.id });
                  }
                }}
              >
                <Icon name="plus" /> Ajouter à mes recettes
              </button>
            </div>
          ) : (
            <div class="actions-grid">
              {steps.length > 0 && (
                <button class="btn primary lg" onClick={() => openOverlay({ kind: "cook", id: r.id, portions })}>
                  <Icon name="chef" /> Cuisiner pas à pas
                </button>
              )}
              <div class="row">
                <button class="btn grow" onClick={() => openSheet("cooked", { id: r.id, portions })}>
                  ✅ J'ai cuisiné ce plat
                </button>
                <button class="btn grow" onClick={() => openSheet("plan", { id: r.id })}>
                  <Icon name="calendar" /> Planifier
                </button>
              </div>
              {(missing > 0 || !f.length) && (
                <button class="btn accent" onClick={() => addMissingToShopping(r, portions)}>
                  <Icon name="cart" /> {f.length ? "Ajouter les " + count(missing, "manquant") + " aux courses" : "Ajouter les ingrédients aux courses"}
                </button>
              )}
              {user.value && (
                <button class="btn ghost" onClick={() => openSheet("post", { id: r.id })}>
                  <Icon name="camera" /> Partager une photo de mon plat
                </button>
              )}
            </div>
          )}

          <div class="section-head mt-l">
            <h2>Préparation</h2>
            <span class="small muted">{count(steps.length, "étape")}</span>
          </div>
          <ol class="steps">
            {steps.map((e, k) => (
              <li class={done[k] ? "done" : ""} onClick={() => setDone({ ...done, [k]: !done[k] })}>
                <span>{e}</span>
              </li>
            ))}
          </ol>
          <p class="hint">Touche une étape pour la marquer comme faite.</p>

          {com.length > 0 && (
            <div class="mt-l">
              <div class="section-head">
                <h2>📸 Réalisations</h2>
                <span class="small muted">{count(com.length, "photo")}</span>
              </div>
              <div class="gallery">
                {com.slice(0, 12).map((p) => (
                  <img src={p.url} alt="" loading="lazy" />
                ))}
              </div>
            </div>
          )}

          {!preview && <NoteBox id={r.id} />}
          <PriceBlock r={r} portions={portions} />

          {r.perso && !preview && (
            <div class="row mt-l noprint">
              <button class="btn grow" onClick={() => openOverlay({ kind: "editor", id: r.id })}>
                <Icon name="edit" /> Modifier
              </button>
              <button
                class="btn danger grow"
                onClick={() =>
                  confirmDelete("Supprimer cette recette ?", "« " + r.nom + " » sera retirée de tes recettes.", () => {
                    closeOverlay();
                    deletePersoRecipe(r.id);
                  })
                }
              >
                <Icon name="trash" /> Supprimer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Aperçu d'une recette d'un autre profil (pas encore dans le catalogue de l'utilisateur). */
const previews: Record<string, Recipe> = {};
export function openPreview(r: Recipe) {
  previews[r.id] = r;
  openOverlay({ kind: "recipe", id: r.id, preview: true });
}
