import { useState } from "preact/hooks";
import { CATEGORIES, type Recipe } from "../../core/recipe";
import { clean } from "../../core/text";
import { parseQty, RECIPE_UNITS } from "../../core/units";
import { compressPhoto } from "../../services/device";
import { sb } from "../../services/supabase";
import { importFromUrl } from "../../services/web";
import { deletePersoRecipe, savePersoRecipe } from "../../state/actions";
import { findRecipe, user } from "../../state/store";
import { closeOverlay, replaceTop, toast, type Overlay } from "../../state/ui";
import { confirmDelete } from "../components/common";
import { Icon } from "../components/Icon";

const EMOJIS = ["🍽️", "🍝", "🍲", "🥘", "🍗", "🥩", "🐟", "🦐", "🥗", "🍕", "🥪", "🍳", "🥔", "🍆", "🍚", "🍜", "🌮", "🥧", "🍰", "🍪", "🥞", "🥣", "🍎", "🧀", "🍔", "🥟", "🫕", "🍛"];

interface Draft {
  id: string | null;
  nom: string;
  emoji: string;
  cat: string;
  diff: string;
  prep: string;
  cuisson: string;
  portions: string;
  photo: string;
  ing: { q: string; u: string; n: string }[];
  etapes: string[];
  src: string;
  srcUrl: string;
  credit: string;
}
const fromRecipe = (r: Recipe): Draft => ({
  id: r.id,
  nom: r.nom,
  emoji: r.emoji,
  cat: r.cat,
  diff: r.diff,
  prep: String(r.prep),
  cuisson: String(r.cuisson),
  portions: String(r.portions),
  photo: r.photo || "",
  ing: r.ing.map((i) => ({ q: i.q == null ? "" : String(i.q).replace(".", ","), u: i.u, n: i.n })),
  etapes: r.etapes.slice(),
  src: r.src || "",
  srcUrl: r.srcUrl || "",
  credit: r.credit || ""
});
const blank = (): Draft => ({
  id: null,
  nom: "",
  emoji: "🍽️",
  cat: "Plat",
  diff: "Facile",
  prep: "15",
  cuisson: "20",
  portions: "4",
  photo: "",
  ing: [
    { q: "", u: "", n: "" },
    { q: "", u: "", n: "" },
    { q: "", u: "", n: "" }
  ],
  etapes: ["", ""],
  src: "",
  srcUrl: "",
  credit: ""
});

export function Editor({ o }: { o: Extract<Overlay, { kind: "editor" }> }) {
  const existing = o.id ? findRecipe(o.id) : null;
  const [d, setD] = useState<Draft>(existing ? fromRecipe(existing) : blank());
  const [url, setUrl] = useState(o.importUrl || "");
  const [imp, setImp] = useState<{ state: "" | "load" | "ok" | "err"; msg: string }>({ state: "", msg: "" });
  const [err, setErr] = useState("");
  const [busyPhoto, setBusyPhoto] = useState(false);
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });
  const setIng = (k: number, p: Partial<Draft["ing"][number]>) => set({ ing: d.ing.map((x, i) => (i === k ? { ...x, ...p } : x)) });

  const doImport = async () => {
    setImp({ state: "load", msg: "Récupération de la recette… (quelques secondes)" });
    const res = await importFromUrl(url);
    if (!res.ok) return setImp({ state: "err", msg: res.error });
    const r = res.recipe;
    setD({
      ...d,
      nom: r.nom,
      cat: r.cat,
      portions: String(r.portions),
      prep: String(r.prep),
      cuisson: String(r.cuisson),
      photo: r.photo,
      ing: r.ing.length ? r.ing.map((i) => ({ q: i.q == null ? "" : String(Math.round(i.q * 100) / 100).replace(".", ","), u: i.u, n: i.n })) : d.ing,
      etapes: r.etapes.length ? r.etapes : d.etapes,
      src: /marmiton/.test(res.url) ? "marmiton" : "web",
      srcUrl: res.url
    });
    setUrl("");
    setImp(
      r.ing.length && r.etapes.length
        ? { state: "ok", msg: "✅ « " + r.nom + " » importée : " + r.ing.length + " ingrédients, " + r.etapes.length + " étapes. Relis et corrige si besoin." }
        : { state: "err", msg: "Recette trouvée, mais " + (!r.ing.length ? "les ingrédients" : "les étapes") + " n'ont pas pu être lus : complète à la main." }
    );
  };

  const onPhoto = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files && input.files[0];
    input.value = "";
    if (!f) return;
    setBusyPhoto(true);
    const c = await compressPhoto(f, user.value ? 1280 : 720, user.value ? 0.82 : 0.72);
    if (!c) {
      setBusyPhoto(false);
      return toast("Photo illisible");
    }
    if (user.value && sb) {
      // connecté : la photo va dans le stockage en ligne, la recette ne garde que son adresse
      const path = user.value.id + "/recette-" + Date.now() + ".jpg";
      const up = await sb.storage.from("dishes").upload(path, c.blob, { contentType: "image/jpeg" });
      if (!up.error) {
        set({ photo: sb.storage.from("dishes").getPublicUrl(path).data.publicUrl });
        setBusyPhoto(false);
        return;
      }
    }
    set({ photo: c.dataUrl });
    setBusyPhoto(false);
  };

  const save = () => {
    const ing = d.ing.filter((i) => clean(i.n)).map((i) => ({ q: parseQty(i.q), u: i.u, n: clean(i.n) }));
    const etapes = d.etapes.map(clean).filter(Boolean);
    if (!clean(d.nom)) return setErr("Donne un nom à ta recette.");
    if (!ing.length) return setErr("Ajoute au moins un ingrédient.");
    if (!etapes.length) return setErr("Ajoute au moins une étape.");
    const r = savePersoRecipe({
      id: d.id || "",
      nom: d.nom,
      emoji: d.emoji,
      cat: d.cat,
      diff: d.diff,
      prep: parseInt(d.prep, 10) || 0,
      cuisson: parseInt(d.cuisson, 10) || 0,
      portions: parseInt(d.portions, 10) || 4,
      ing,
      etapes,
      photo: d.photo,
      perso: true,
      src: d.src,
      srcUrl: d.srcUrl,
      credit: d.credit
    });
    if (!r) return setErr("Recette incomplète.");
    toast(existing ? "✅ Recette mise à jour" : "✅ « " + r.nom + " » ajoutée à tes recettes");
    if (existing) closeOverlay();
    else replaceTop({ kind: "recipe", id: r.id });
  };

  return (
    <div class="overlay" role="dialog" aria-label={existing ? "Modifier la recette" : "Nouvelle recette"}>
      <div class="ov-inner">
        <div class="ov-head">
          <button class="iconbtn" aria-label="Fermer" onClick={closeOverlay}>
            <Icon name="close" />
          </button>
          <h1>{existing ? "Modifier la recette" : "Nouvelle recette"}</h1>
          <button class="btn primary sm" onClick={save}>
            Enregistrer
          </button>
        </div>

        {!existing && (
          <div class="panel tint">
            <b>🔗 Importer depuis un site</b>
            <p class="small muted mt-s">Marmiton, 750g, CuisineAZ, Journal des Femmes, Cuisine Actuelle, Ricardo, BBC Good Food… colle l'adresse de la recette.</p>
            <div class="row mt-s">
              <input class="input" inputMode="url" placeholder="https://www.marmiton.org/recettes/…" value={url} autocapitalize="off" spellcheck={false} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} />
              <button class="btn primary" disabled={!url.trim() || imp.state === "load"} onClick={doImport}>
                {imp.state === "load" ? "…" : "Importer"}
              </button>
            </div>
            {imp.msg && <div class={"msg " + imp.state}>{imp.msg}</div>}
          </div>
        )}

        <label class="field mt">
          <span>Nom de la recette</span>
          <input class="input" value={d.nom} maxLength={90} placeholder="Ex. Le gratin de mamie" onInput={(e) => set({ nom: (e.target as HTMLInputElement).value })} />
        </label>

        <div class="mt">
          <div class="label">Photo</div>
          <label class="photo-drop mt-s" style={{ aspectRatio: d.photo ? "4/3" : "16/6" }}>
            {d.photo ? <img src={d.photo} alt="" /> : <span>{busyPhoto ? "Envoi…" : "📷 Ajouter une photo du plat"}</span>}
            <input type="file" accept="image/*" hidden onChange={onPhoto} />
          </label>
          {d.photo && (
            <button class="btn sm ghost mt-s" onClick={() => set({ photo: "" })}>
              Retirer la photo
            </button>
          )}
        </div>

        <div class="mt">
          <div class="label">Icône</div>
          <div class="emoji-pick mt-s">
            {EMOJIS.map((e) => (
              <button class={d.emoji === e ? "on" : ""} aria-pressed={d.emoji === e} onClick={() => set({ emoji: e })}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div class="row mt">
          <label class="field grow">
            <span>Catégorie</span>
            <select class="select" value={d.cat} onChange={(e) => set({ cat: (e.target as HTMLSelectElement).value })}>
              {CATEGORIES.map((c) => (
                <option value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label class="field grow">
            <span>Difficulté</span>
            <select class="select" value={d.diff} onChange={(e) => set({ diff: (e.target as HTMLSelectElement).value })}>
              {["Facile", "Moyen", "Difficile"].map((c) => (
                <option value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div class="row mt">
          <label class="field grow">
            <span>Préparation (min)</span>
            <input class="input" inputMode="numeric" value={d.prep} onInput={(e) => set({ prep: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field grow">
            <span>Cuisson (min)</span>
            <input class="input" inputMode="numeric" value={d.cuisson} onInput={(e) => set({ cuisson: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field grow">
            <span>Personnes</span>
            <input class="input" inputMode="numeric" value={d.portions} onInput={(e) => set({ portions: (e.target as HTMLInputElement).value })} />
          </label>
        </div>

        <div class="section-head mt-l">
          <h2>Ingrédients</h2>
        </div>
        <datalist id="ing-names" />
        {d.ing.map((i, k) => (
          <div class="edrow">
            <input class="input" inputMode="decimal" placeholder="Qté" aria-label="Quantité" value={i.q} onInput={(e) => setIng(k, { q: (e.target as HTMLInputElement).value })} />
            <select class="select" aria-label="Unité" value={i.u} onChange={(e) => setIng(k, { u: (e.target as HTMLSelectElement).value })}>
              {RECIPE_UNITS.map(([v, l]) => (
                <option value={v}>{l}</option>
              ))}
              {!RECIPE_UNITS.some(([v]) => v === i.u) && <option value={i.u}>{i.u}</option>}
            </select>
            <input class="input" placeholder="Ingrédient" aria-label="Ingrédient" value={i.n} onInput={(e) => setIng(k, { n: (e.target as HTMLInputElement).value })} />
            <button class="del" aria-label="Retirer l'ingrédient" onClick={() => set({ ing: d.ing.filter((_, j) => j !== k) })}>
              <Icon name="close" />
            </button>
          </div>
        ))}
        <button class="btn sm" onClick={() => set({ ing: [...d.ing, { q: "", u: "", n: "" }] })}>
          <Icon name="plus" /> Ingrédient
        </button>

        <div class="section-head mt-l">
          <h2>Étapes</h2>
        </div>
        {d.etapes.map((e, k) => (
          <div class="edstep">
            <span class="n">{k + 1}</span>
            <textarea class="textarea" style={{ minHeight: 70 }} placeholder="Décris l'étape…" value={e} onInput={(ev) => set({ etapes: d.etapes.map((x, j) => (j === k ? (ev.target as HTMLTextAreaElement).value : x)) })} />
            <button class="del" aria-label="Retirer l'étape" onClick={() => set({ etapes: d.etapes.filter((_, j) => j !== k) })}>
              <Icon name="close" />
            </button>
          </div>
        ))}
        <button class="btn sm" onClick={() => set({ etapes: [...d.etapes, ""] })}>
          <Icon name="plus" /> Étape
        </button>
        <p class="hint">Astuce : écris une durée dans une étape (« laisser mijoter 20 min ») et le mode cuisine proposera un minuteur.</p>

        {err && <div class="msg err">{err}</div>}
        <div class="row mt-l">
          {existing && (
            <button
              class="btn danger"
              onClick={() =>
                confirmDelete("Supprimer cette recette ?", "« " + existing.nom + " » sera retirée de tes recettes.", () => {
                  closeOverlay();
                  setTimeout(() => {
                    closeOverlay();
                    deletePersoRecipe(existing.id);
                  }, 50);
                })
              }
            >
              <Icon name="trash" />
            </button>
          )}
          <button class="btn primary lg grow" onClick={save}>
            Enregistrer la recette
          </button>
        </div>
      </div>
    </div>
  );
}
