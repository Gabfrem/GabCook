import { useState } from "preact/hooks";
import { ALLERGENES, AVERSIONS, CUISINES, EQUIPEMENTS } from "../../core/classify";
import { missingFor } from "../../core/fridge";
import { agendaCompte, cleJour, JOURS_CT, JOURS_LONG, joursAgenda, MOIS_CT, recettesAgenda, REPAS, slotDe, type Meal } from "../../core/planner";
import { euros } from "../../core/pricing";
import { count } from "../../core/text";
import { agendaToShopping, candidatsSemaine, clearAgenda, coutPlat, eatLeftovers, generateWeek, proposeFor, setSlot } from "../../state/actions";
import { agenda, findRecipe, fridge, semaine, type Semaine } from "../../state/store";
import { askConfirm, closeOverlay, openOverlay, openSheet } from "../../state/ui";
import { Cover } from "../components/Cover";
import { Empty, minutesOf, openRecipe } from "../components/common";
import { Icon } from "../components/Icon";

export const titreJour = (d: Date, i: number) =>
  (i === 0 ? "Aujourd'hui · " : i === 1 ? "Demain · " : "") + JOURS_LONG[d.getDay()] + " " + d.getDate() + " " + MOIS_CT[d.getMonth()];

function SlotView({ cle, repas }: { cle: string; repas: Meal }) {
  const s = slotDe(agenda.value, cle, repas);
  const label = repas === "midi" ? "Midi" : "Soir";
  if (!s)
    return (
      <div class="meal">
        <div class="meal-label">{label}</div>
        <button class="slot-empty" onClick={() => openSheet("slot", { cle, repas })}>
          <span class="plus">＋</span>
          <span>Ajouter un repas</span>
        </button>
      </div>
    );
  if (s.t === "restes")
    return (
      <div class="meal">
        <div class="meal-label">{label}</div>
        <div class="slot restes">
          <span style={{ fontSize: 28 }}>♻️</span>
          <div class="grow">
            <b>Les restes</b>
            <div class="small muted">Rien à cuisiner pour ce repas</div>
          </div>
          <button class="del" aria-label="Retirer" onClick={() => setSlot(cle, repas, null)}>
            <Icon name="close" />
          </button>
        </div>
      </div>
    );
  const r = findRecipe(s.id);
  if (!r)
    return (
      <div class="meal">
        <div class="meal-label">{label}</div>
        <div class="slot restes">
          <span class="grow">Recette introuvable</span>
          <button class="del" aria-label="Retirer" onClick={() => setSlot(cle, repas, null)}>
            <Icon name="close" />
          </button>
        </div>
      </div>
    );
  const manque = fridge.value.length ? missingFor(fridge.value, r).length : -1;
  return (
    <div class="meal">
      <div class="meal-label">{label}</div>
      <div class="slot">
        <button style={{ display: "contents" }} onClick={() => openRecipe(r.id)} aria-label={"Ouvrir " + r.nom}>
          <Cover r={r} />
          <div class="info">
            <h3>{r.nom}</h3>
            <span class="small muted">
              ⏱ {minutesOf(r)} min · {r.diff}
            </span>
            {manque === 0 ? <span class="tag ok" style={{ alignSelf: "flex-start" }}>✓ Prêt à cuisiner</span> : manque > 0 ? <span class="tag" style={{ alignSelf: "flex-start" }}>Il manque {manque}</span> : null}
          </div>
        </button>
        <div class="tools">
          <button aria-label="Proposer un autre plat" title="Un autre plat" onClick={() => proposeFor(cle, repas)}>
            🎲
          </button>
          <button aria-label="J'ai mangé les restes" title="Les restes (décale le plat)" onClick={() => eatLeftovers(cle, repas)}>
            ♻️
          </button>
          <button aria-label="Retirer" title="Retirer" onClick={() => setSlot(cle, repas, null)}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export function Week() {
  const jours = joursAgenda();
  const [sel, setSel] = useState(cleJour(jours[0]));
  const a = agenda.value;
  const iSel = Math.max(0, jours.findIndex((d) => cleJour(d) === sel));
  const n = agendaCompte(a);
  const cout = recettesAgenda(a).reduce((t, id) => {
    const r = findRecipe(id);
    return t + (r ? coutPlat(r) : 0);
  }, 0);
  return (
    <div>
      <header class="topbar">
        <div class="grow">
          <h1 class="screen-title">Ma semaine</h1>
          <p class="screen-sub">{n ? count(n, "repas planifié", "repas planifiés") + " · ≈ " + euros(cout) : "Planifie midi et soir, Yummly s'occupe des courses"}</p>
        </div>
        <button class="btn accent sm" onClick={() => openOverlay({ kind: "weekWizard" })}>
          <Icon name="sparkles" /> Proposer
        </button>
      </header>
      <div class="days" role="tablist" aria-label="Jours">
        {jours.map((d, i) => {
          const k = cleJour(d),
            m = slotDe(a, k, "midi"),
            s = slotDe(a, k, "soir");
          return (
            <button role="tab" aria-selected={k === sel} class={"day" + (k === sel ? " on" : "")} onClick={() => setSel(k)}>
              <small>{i === 0 ? "auj." : JOURS_CT[d.getDay()]}</small>
              <b>{d.getDate()}</b>
              <span class="dots">
                {m && <i class={m.t === "restes" ? "r" : ""} />}
                {s && <i class={s.t === "restes" ? "r" : ""} />}
              </span>
            </button>
          );
        })}
      </div>
      <h2 class="mt" style={{ fontSize: 21 }}>
        {titreJour(jours[iSel], iSel)}
      </h2>
      {REPAS.map((rp) => (
        <SlotView cle={sel} repas={rp} key={sel + rp} />
      ))}
      <div class="stack mt-l">
        {n > 0 ? (
          <>
            <button class="btn primary lg" onClick={agendaToShopping}>
              <Icon name="cart" /> Ajouter les ingrédients de la semaine aux courses
            </button>
            <div class="row">
              <button class="btn grow" onClick={() => openOverlay({ kind: "weekWizard" })}>
                <Icon name="sparkles" /> Compléter ma semaine
              </button>
              <button class="btn danger" onClick={() => askConfirm({ title: "Effacer la semaine ?", text: "Tous les repas planifiés seront retirés (tu pourras annuler).", ok: "Effacer", danger: true, onOk: clearAgenda })}>
                <Icon name="trash" />
              </button>
            </div>
          </>
        ) : (
          <Empty icon="🗓️" title="Rien de prévu pour l'instant" text="Laisse Yummly te proposer des repas variés selon ton matériel, tes goûts et ton budget — ou choisis-les toi-même.">
            <button class="btn primary" onClick={() => openOverlay({ kind: "weekWizard" })}>
              <Icon name="sparkles" /> Proposer ma semaine
            </button>
          </Empty>
        )}
      </div>
    </div>
  );
}

/* ---------- assistant ---------- */
const STEPS = ["Ton matériel", "Tes goûts", "Une envie ?", "Combien de repas ?", "Ton budget"];
export function WeekWizard() {
  const [step, setStep] = useState(() => {
    // 1re fois : le matériel le plus courant est pré-coché
    if (!semaine.value.equip) semaine.value = { ...semaine.value, equip: ["four", "plaques", "micro"] };
    return 0;
  });
  const s = semaine.value;
  const set = (p: Partial<Semaine>) => (semaine.value = { ...semaine.value, ...p });
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const nbPossibles = candidatsSemaine().length;
  const last = step === STEPS.length - 1;
  return (
    <div class="overlay" role="dialog" aria-label="Proposer ma semaine">
      <div class="ov-inner">
        <div class="ov-head">
          <button class="iconbtn" aria-label="Fermer" onClick={closeOverlay}>
            <Icon name="close" />
          </button>
          <h1>Proposer ma semaine</h1>
        </div>
        <div class="cook-prog" style={{ margin: "0 0 18px" }}>
          <i style={{ width: ((step + 1) / STEPS.length) * 100 + "%" }} />
        </div>
        <p class="small muted">
          Étape {step + 1} sur {STEPS.length}
        </p>
        <h2 class="mt-s" style={{ fontSize: 26 }}>
          {STEPS[step]}
        </h2>
        {step === 0 && (
          <>
            <p class="muted mt-s">On ne te proposera que des plats réalisables avec ce que tu as.</p>
            <div class="wizard-grid mt">
              {EQUIPEMENTS.map((x) => {
                const on = (s.equip || []).includes(x.id);
                return (
                  <button class={"option" + (on ? " on" : "")} aria-pressed={on} onClick={() => set({ equip: toggle(s.equip || [], x.id) })}>
                    <span class="ic">{x.emoji}</span>
                    <b>{x.nom}</b>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p class="muted mt-s">Ce que tu ne veux pas voir dans ta semaine.</p>
            <div class="chips wrap mt">
              {AVERSIONS.map((x) => (
                <button class={"chip" + (s.prefs.deteste.includes(x.id) ? " on" : "")} onClick={() => set({ prefs: { ...s.prefs, deteste: toggle(s.prefs.deteste, x.id) } })}>
                  {x.nom}
                </button>
              ))}
            </div>
            <h3 class="mt-l" style={{ fontSize: 19 }}>
              Allergies
            </h3>
            <p class="muted small mt-s">Ces ingrédients seront totalement écartés.</p>
            <div class="chips wrap mt-s">
              {ALLERGENES.map((x) => (
                <button class={"chip" + (s.prefs.allerg.includes(x.id) ? " on" : "")} onClick={() => set({ prefs: { ...s.prefs, allerg: toggle(s.prefs.allerg, x.id) } })}>
                  {x.nom}
                </button>
              ))}
            </div>
            <p class="hint">Astuce : dans les réglages, tu peux appliquer ces préférences à toutes les suggestions.</p>
          </>
        )}
        {step === 2 && (
          <>
            <p class="muted mt-s">Tu peux orienter toute la semaine vers une cuisine. C'est facultatif.</p>
            <div class="chips wrap mt">
              <button class={"chip" + (!s.cuisine ? " on" : "")} onClick={() => set({ cuisine: "" })}>
                Peu importe
              </button>
              {CUISINES.map((c) => (
                <button class={"chip" + (s.cuisine === c.id ? " on" : "")} onClick={() => set({ cuisine: c.id })}>
                  {c.emoji} {c.nom}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div class="row mt" style={{ justifyContent: "center", gap: 18 }}>
              <button class="iconbtn" aria-label="Moins" onClick={() => set({ nb: Math.max(1, s.nb - 1) })}>
                <Icon name="minus" />
              </button>
              <div class="center">
                <b style={{ fontFamily: "var(--display)", fontSize: 48 }}>{s.nb}</b>
                <div class="muted">{s.nb > 1 ? "repas à cuisiner" : "repas à cuisiner"}</div>
              </div>
              <button class="iconbtn" aria-label="Plus" onClick={() => set({ nb: Math.min(14, s.nb + 1) })}>
                <Icon name="plus" />
              </button>
            </div>
            <div class="options mt">
              {(
                [
                  ["tous", "Midi et soir", "Un plat différent à chaque repas"],
                  ["midi", "Seulement le midi", "Le soir, on finit les restes"],
                  ["soir", "Seulement le soir", "Le lendemain midi, les restes"]
                ] as const
              ).map(([v, t, d]) => (
                <button class={"option" + ((s.creneaux || "tous") === v ? " on" : "")} onClick={() => set({ creneaux: v })}>
                  <span class="grow">
                    <b>{t}</b>
                    <small>{d}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <p class="muted mt-s">Ce que tu veux mettre dans les courses pour ces {count(s.nb, "repas", "repas")} (4 parts par plat).</p>
            <div class="center mt">
              <b style={{ fontFamily: "var(--display)", fontSize: 44 }}>{s.budget ? euros(s.budget) : "Sans limite"}</b>
              <div class="muted small">{s.budget ? "soit ≈ " + euros(s.budget / Math.max(1, s.nb)) + " par plat" : ""}</div>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              step="5"
              value={s.budget}
              aria-label="Budget"
              style={{ width: "100%", marginTop: 16, accentColor: "var(--accent)" }}
              onInput={(e) => set({ budget: +(e.target as HTMLInputElement).value })}
            />
            <p class="hint">Glisse tout à gauche pour ne pas fixer de budget.</p>
          </>
        )}
        <p class={"small mt-l " + (nbPossibles < 30 ? "" : "muted")} style={nbPossibles < 30 ? { color: "var(--warn)", fontWeight: 650 } : {}}>
          {nbPossibles} plat{nbPossibles > 1 ? "s" : ""} correspondent à tes réglages{nbPossibles < 30 ? " — c'est peu : coche plus de matériel ou retire une contrainte." : "."}
        </p>
        <div class="row mt">
          <button class="btn lg grow" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <Icon name="back" /> Retour
          </button>
          {last ? (
            <button
              class="btn primary lg grow"
              disabled={!nbPossibles}
              onClick={() => {
                generateWeek();
                closeOverlay();
              }}
            >
              <Icon name="sparkles" /> Générer
            </button>
          ) : (
            <button class="btn primary lg grow" disabled={step === 0 && !(s.equip && s.equip.length)} onClick={() => setStep(step + 1)}>
              Continuer <Icon name="chevron" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
