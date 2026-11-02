import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { CUISINES } from "../../core/classify";
import { searchRecipes } from "../../core/search";
import { count } from "../../core/text";
import { setCookMode } from "../../state/actions";
import { cookMode, favorites, fridge, perso } from "../../state/store";
import { closeOverlay, type Overlay } from "../../state/ui";
import { Empty, RecipeCard, Sheet, useDebounced } from "../components/common";
import { Icon } from "../components/Icon";
import { applyFilters, baseList, emptyFilters, presetFilters, sortList, type Filters, type Sort } from "./lists";

const CATS: [string, string][] = [
  ["", "Tout"],
  ["Plat", "Plats"],
  ["Entrée", "Entrées"],
  ["Accompagnement", "Accompagnements"],
  ["Dessert", "Desserts"],
  ["Apéro", "Apéro"],
  ["Petit-déj", "Petit-déj"]
];
const SORTS: [Sort, string][] = [
  ["pertinence", "Pertinence"],
  ["note", "Mieux notées"],
  ["rapide", "Plus rapides"],
  ["prix", "Moins chères"],
  ["az", "A → Z"]
];
const PRESET_TITLES: Record<string, string> = {
  cookable: "Prêt à cuisiner",
  favorites: "Mes favoris",
  mine: "Mes recettes",
  saison: "De saison",
  rapide: "Prêt en 20 minutes",
  nouveau: "Nouveautés",
  vege: "Végétarien",
  antigaspi: "Anti-gaspi",
  planned: "À réaliser"
};

function FiltersSheet({ f, set, onClose, nb }: { f: Filters; set: (p: Partial<Filters>) => void; onClose: () => void; nb: number }) {
  const grp = (titre: string, opts: [string, string][], cur: string, key: keyof Filters) => (
    <div class="mt">
      <div class="label">{titre}</div>
      <div class="chips wrap mt-s">
        {opts.map(([v, l]) => (
          <button class={"chip" + (cur === v ? " on" : "")} onClick={() => set({ [key]: v } as any)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
  const flag = (key: keyof Filters, label: string, show = true) =>
    show && (
      <button class={"chip" + (f[key] ? " on" : "")} onClick={() => set({ [key]: !f[key] } as any)}>
        {label}
      </button>
    );
  return (
    <Sheet onClose={onClose} labelledBy="flt">
      <h2 id="flt">Filtres</h2>
      {grp("Temps total", [["", "Peu importe"], ["court", "≤ 20 min"], ["moyen", "20 – 45 min"], ["long", "+ de 45 min"]], f.temps, "temps")}
      {grp("Difficulté", [["", "Toutes"], ["Facile", "Facile"], ["Moyen", "Moyen"], ["Difficile", "Difficile"]], f.diff, "diff")}
      {grp("Budget par personne", [["", "Peu importe"], ["1", "≤ 1 €"], ["2", "≤ 2 €"], ["3", "≤ 3 €"], ["5", "≤ 5 €"]], f.prix, "prix")}
      {grp("Cuisine", [["", "Toutes"], ...CUISINES.map((c) => [c.id, c.emoji + " " + c.nom] as [string, string])], f.cuisine, "cuisine")}
      <div class="mt">
        <div class="label">Autres</div>
        <div class="chips wrap mt-s">
          {flag("vege", "🌱 Végétarien")}
          {flag("saison", "🍂 De saison")}
          {flag("cookable", "🧊 Prêt avec mon frigo", fridge.value.length > 0)}
          {flag("fav", "❤️ Favoris", favorites.value.length > 0)}
          {flag("mine", "✏️ Mes recettes", perso.value.length > 0)}
          {flag("nouveau", "✨ Nouveautés")}
        </div>
      </div>
      <div class="mt">
        <div class="label">Appareil de cuisson</div>
        <div class="chips wrap mt-s">
          <button class={"chip" + (cookMode.value === "airfryer" ? " on" : "")} onClick={() => setCookMode("airfryer")}>
            🍟 Air fryer
          </button>
          <button class={"chip" + (cookMode.value === "micro" ? " on" : "")} onClick={() => setCookMode("micro")}>
            🔆 Micro-ondes
          </button>
        </div>
        <p class="hint">Les recettes et leurs étapes sont adaptées à l'appareil choisi.</p>
      </div>
      <div class="sheet-actions">
        <button
          class="btn"
          onClick={() => {
            set({ ...emptyFilters(), cat: f.cat });
          }}
        >
          Effacer
        </button>
        <button class="btn primary" onClick={onClose}>
          Voir {count(nb, "recette")}
        </button>
      </div>
    </Sheet>
  );
}

export function Explore({ o }: { o: Extract<Overlay, { kind: "explore" }> }) {
  const [q, setQ] = useState(o.q || "");
  const [f, setF] = useState<Filters>({ ...emptyFilters(), cat: o.cat || "", cuisine: o.cuisine || "", ...presetFilters(o.preset) });
  const [sort, setSort] = useState<Sort>("pertinence");
  const [limit, setLimit] = useState(24);
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q, 160);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (o.q !== undefined && input.current) input.current.focus();
  }, []);
  useEffect(() => setLimit(24), [dq, JSON.stringify(f), sort]);
  const results = useMemo(() => {
    const base = applyFilters(baseList(), f);
    return dq.trim() ? (sort === "pertinence" ? searchRecipes(base, dq) : sortList(searchRecipes(base, dq), sort)) : sortList(base, sort);
  }, [dq, JSON.stringify(f), sort, fridge.value, favorites.value, cookMode.value]);
  const set = (p: Partial<Filters>) => setF({ ...f, ...p });
  const nbFiltres = (["temps", "diff", "prix", "cuisine"] as const).filter((k) => f[k]).length + (["vege", "saison", "cookable", "fav", "mine", "nouveau", "antigaspi", "planned"] as const).filter((k) => f[k]).length + (cookMode.value !== "normal" ? 1 : 0);
  const titre = o.preset ? PRESET_TITLES[o.preset] : f.cat ? CATS.find((c) => c[0] === f.cat)![1] : o.cuisine ? CUISINES.find((c) => c.id === o.cuisine)?.nom || "Recettes" : "Recettes";
  return (
    <div class="overlay" role="dialog" aria-label={titre}>
      <div class="ov-inner">
        <div class="ov-head">
          <button class="iconbtn" aria-label="Retour" onClick={closeOverlay}>
            <Icon name="back" />
          </button>
          <h1>{titre}</h1>
          <button class={"iconbtn" + (nbFiltres ? " on" : "")} aria-label="Filtres" onClick={() => setOpen(true)} style={nbFiltres ? { color: "var(--rust)" } : {}}>
            <Icon name="filter" />
          </button>
        </div>
        <div class="searchbar">
          <Icon name="search" class="lead" />
          <input
            ref={input}
            class="input"
            type="search"
            value={q}
            placeholder="Un plat, un ingrédient, « poulet citron »…"
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            enterKeyHint="search"
            aria-label="Rechercher"
          />
          {q && (
            <button class="clear" aria-label="Effacer" onClick={() => setQ("")}>
              <Icon name="close" />
            </button>
          )}
        </div>
        <div class="chips mt">
          {CATS.map(([c, l]) => (
            <button class={"chip" + (f.cat === c ? " on" : "")} onClick={() => set({ cat: c })}>
              {l}
            </button>
          ))}
        </div>
        <div class="row" style={{ justifyContent: "space-between", margin: "6px 0 12px" }}>
          <span class="small muted">{count(results.length, "recette")}</span>
          <select class="select" style={{ width: "auto", minHeight: 38, fontSize: 14 }} value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as Sort)} aria-label="Trier">
            {SORTS.map(([v, l]) => (
              <option value={v}>{l}</option>
            ))}
          </select>
        </div>
        {nbFiltres > 0 && (
          <div class="chips">
            {f.temps && <button class="chip on" onClick={() => set({ temps: "" })}>⏱ {f.temps === "court" ? "≤ 20 min" : f.temps === "moyen" ? "20–45 min" : "+45 min"} ✕</button>}
            {f.diff && <button class="chip on" onClick={() => set({ diff: "" })}>{f.diff} ✕</button>}
            {f.prix && <button class="chip on" onClick={() => set({ prix: "" })}>≤ {f.prix} € ✕</button>}
            {f.cuisine && <button class="chip on" onClick={() => set({ cuisine: "" })}>{CUISINES.find((c) => c.id === f.cuisine)?.nom} ✕</button>}
            {f.vege && <button class="chip on" onClick={() => set({ vege: false })}>Végétarien ✕</button>}
            {f.saison && <button class="chip on" onClick={() => set({ saison: false })}>De saison ✕</button>}
            {f.cookable && <button class="chip on" onClick={() => set({ cookable: false })}>Prêt avec mon frigo ✕</button>}
            {f.fav && <button class="chip on" onClick={() => set({ fav: false })}>Favoris ✕</button>}
            {f.mine && <button class="chip on" onClick={() => set({ mine: false })}>Mes recettes ✕</button>}
            {f.nouveau && <button class="chip on" onClick={() => set({ nouveau: false })}>Nouveautés ✕</button>}
            {f.antigaspi && <button class="chip on" onClick={() => set({ antigaspi: false })}>Anti-gaspi ✕</button>}
            {f.planned && <button class="chip on" onClick={() => set({ planned: false })}>À réaliser ✕</button>}
            {cookMode.value !== "normal" && <button class="chip on" onClick={() => setCookMode(cookMode.value)}>{cookMode.value === "airfryer" ? "🍟 Air fryer" : "🔆 Micro-ondes"} ✕</button>}
          </div>
        )}
        {results.length ? (
          <>
            <div class="grid mt-s">
              {results.slice(0, limit).map((r) => (
                <RecipeCard r={r} key={r.id} />
              ))}
            </div>
            {results.length > limit && (
              <div class="loadmore">
                <button class="btn" onClick={() => setLimit(limit + 24)}>
                  Voir plus ({results.length - limit})
                </button>
              </div>
            )}
          </>
        ) : (
          <Empty icon="🍽️" title="Aucune recette ne correspond" text={dq ? "Essaie un autre mot, ou retire un filtre." : "Retire un filtre pour voir plus de recettes."}>
            <button
              class="btn"
              onClick={() => {
                setQ("");
                setF(emptyFilters());
                if (cookMode.value !== "normal") setCookMode(cookMode.value);
              }}
            >
              Tout réafficher
            </button>
          </Empty>
        )}
      </div>
      {open && <FiltersSheet f={f} set={set} onClose={() => setOpen(false)} nb={results.length} />}
    </div>
  );
}
