import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { missingImportant } from "../../core/fridge";
import { prixRecette, euros } from "../../core/pricing";
import { totalTime, viewOf, type Recipe } from "../../core/recipe";
import { buildVocab, suggest, type VocabEntry } from "../../core/suggest";
import { norm } from "../../core/text";
import { COMMON } from "../../core/tables";
import { globalRating, isFav, isPlanned, toggleFav } from "../../state/actions";
import { AF, allRecipes, cookMode, fridge, MO } from "../../state/store";
import { askConfirm, confirmState, hideToast, openOverlay, toastState } from "../../state/ui";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

/* ---------- utilitaires recette ---------- */
export const viewFor = (r: Recipe) => viewOf(r, cookMode.value, AF.value, MO.value);
export const minutesOf = (r: Recipe) => totalTime(r, viewFor(r).cuisson);
export const openRecipe = (id: string, portions?: number) => openOverlay({ kind: "recipe", id, portions });

export function Stars({ id, compact }: { id: string; compact?: boolean }) {
  const { moy, n } = globalRating(id);
  if (!n) return compact ? null : <span class="stars"><span class="votes">Pas encore noté</span></span>;
  return (
    <span class="stars" aria-label={"Note " + moy.toFixed(1) + " sur 5, " + n + " vote" + (n > 1 ? "s" : "")}>
      <Icon name="star" fill />
      {moy.toFixed(1).replace(".", ",")}
      <span class="votes">({n})</span>
    </span>
  );
}

export function FavButton({ id, class: cls = "iconbtn glass fav" }: { id: string; class?: string }) {
  const on = isFav(id);
  return (
    <button
      class={cls + (on ? " on" : "")}
      aria-label={on ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        toggleFav(id);
      }}
    >
      <Icon name="heart" fill={on} />
    </button>
  );
}

/** Carte de recette (grilles et rangées). */
export function RecipeCard({ r, showStatus = true }: { r: Recipe; showStatus?: boolean }) {
  const v = viewFor(r);
  const t = totalTime(r, v.cuisson);
  const f = fridge.value;
  const miss = f.length ? missingImportant(f, r).length : -1;
  return (
    <div class="rcard" role="button" tabIndex={0} onClick={() => openRecipe(r.id)} onKeyDown={(e) => e.key === "Enter" && openRecipe(r.id)}>
      <Cover r={r}>
        <div class="badges">
          {isPlanned(r.id) && <span class="tag accent">📌 Prévu</span>}
          {v.af && <span class="tag">🍟 {v.af.t}°C</span>}
          {v.mo && <span class="tag">🔆 Micro-ondes</span>}
          {r.perso && <span class="tag">✏️ Ma recette</span>}
          {r.nouveau && !r.perso && <span class="tag accent">Nouveau</span>}
        </div>
      </Cover>
      <FavButton id={r.id} />
      <div class="body">
        <h3>{r.nom}</h3>
        <div class="meta">
          <Icon name="clock" />
          {t} min · {r.diff}
        </div>
        <div class="meta">
          <Stars id={r.id} compact />
          <span>≈ {euros(prixRecette(r).parPers)}/pers.</span>
        </div>
        {showStatus && miss >= 0 && (
          <div class="status">
            {miss === 0 ? <span class="tag ok">✓ Prêt à cuisiner</span> : miss <= 2 ? <span class="tag warn">Il manque {miss}</span> : <span class="tag">Il manque {miss}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function Shelf({ list }: { list: Recipe[] }) {
  return (
    <div class="shelf">
      {list.map((r) => (
        <RecipeCard r={r} key={r.id} />
      ))}
    </div>
  );
}

export function Section({ title, link, onLink, children }: { title: string; link?: string; onLink?: () => void; children: ComponentChildren }) {
  return (
    <section class="section">
      <div class="section-head">
        <h2>{title}</h2>
        {link && (
          <button class="link" onClick={onLink}>
            {link} ›
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="big">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

export function Stepper({ value, min = 1, max = 99, onChange, label }: { value: number; min?: number; max?: number; onChange: (v: number) => void; label: (v: number) => string }) {
  return (
    <div class="stepper">
      <button aria-label="Moins" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <output>{label(value)}</output>
      <button aria-label="Plus" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span class="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span />
    </span>
  );
}

export function Avatar({ avatar, name, size = "" }: { avatar?: string; name?: string; size?: "" | "sm" | "xl" }) {
  const a = avatar || "";
  return (
    <span class={"avatar " + size}>
      {a.startsWith("data:") || a.startsWith("http") ? <img src={a} alt="" /> : a || (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

/* ---------- feuille modale ---------- */
export function Sheet({ onClose, children, labelledBy }: { onClose: () => void; children: ComponentChildren; labelledBy?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    document.body.classList.add("noscroll");
    return () => {
      removeEventListener("keydown", k);
      document.body.classList.remove("noscroll");
    };
  }, []);
  return (
    <div class="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const t = toastState.value;
  if (!t) return null;
  return (
    <div class="toast" role="status" aria-live="polite" key={t.id}>
      <span>{t.msg}</span>
      {t.action && (
        <button
          onClick={() => {
            t.action!.run();
            hideToast();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export function ConfirmDialog() {
  const c = confirmState.value;
  if (!c) return null;
  const close = () => {
    confirmState.value = null;
    c.onCancel && c.onCancel();
  };
  return (
    <Sheet onClose={close} labelledBy="cf-title">
      <h2 id="cf-title">{c.title}</h2>
      {c.text && <p class="lead">{c.text}</p>}
      <div class="sheet-actions">
        <button class="btn" onClick={close}>
          {c.cancel || "Annuler"}
        </button>
        <button
          class={"btn " + (c.danger ? "danger" : "primary")}
          onClick={() => {
            confirmState.value = null;
            c.onOk();
          }}
        >
          {c.ok}
        </button>
      </div>
    </Sheet>
  );
}
export const confirmDelete = (title: string, text: string, onOk: () => void) => askConfirm({ title, text, ok: "Supprimer", danger: true, onOk });

/* ---------- saisie d'ingrédient avec suggestions ---------- */
let _vocab: VocabEntry[] | null = null;
let _vocabSig = "";
export function vocab(): VocabEntry[] {
  const sig = allRecipes.value.length + "|" + fridge.value.length;
  if (_vocab && sig === _vocabSig) return _vocab;
  const names: string[] = [];
  allRecipes.value.forEach((r) => r.ing.forEach((i) => names.push(i.n)));
  COMMON.forEach((c) => names.push(c.n));
  fridge.value.forEach((f) => names.push(f.n));
  _vocab = buildVocab(names);
  _vocabSig = sig;
  return _vocab;
}
export function IngredientInput({
  value,
  onInput,
  onPick,
  placeholder,
  autoFocus,
  onEnter,
  id
}: {
  value: string;
  onInput: (v: string) => void;
  onPick?: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, []);
  const list = focus || value ? suggest(vocab(), value, 6) : [];
  const q = norm(value);
  const show = list.length && !(list.length === 1 && norm(list[0]) === q);
  return (
    <div class="grow">
      <input
        ref={ref}
        id={id}
        class="input"
        value={value}
        placeholder={placeholder}
        autocomplete="off"
        autocapitalize="sentences"
        enterKeyHint="done"
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      {show ? (
        <div class="sugg">
          {list.map((n) => (
            <button
              type="button"
              class={norm(n) === q ? "exact" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (onPick ? onPick(n) : onInput(n))}
            >
              {n}
              {norm(n) === q ? " ✓" : ""}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Remonte en haut à l'ouverture d'un écran. */
export function useScrollTop(dep: unknown) {
  useEffect(() => {
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* ignore */
    }
  }, [dep]);
}
