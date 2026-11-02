import { signal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import { emojiOf } from "../../core/catalog";
import { fmtClock, parseDuration, stepIngredients } from "../../core/cooking";
import { cap } from "../../core/text";
import { qtyLabel } from "../../core/units";
import { acquireWake, canSpeak, notify, releaseWake, requestNotify, speak, startAlarm, stopAlarm, stopSpeaking, unlockAudio } from "../../services/device";
import { findRecipe, settings } from "../../state/store";
import { closeOverlay, openSheet, type Overlay } from "../../state/ui";
import { viewFor } from "../components/common";
import { Icon } from "../components/Icon";

/* ---------- minuteurs : ils continuent quand on change d'étape ---------- */
interface Timer {
  id: string;
  label: string;
  total: number;
  endAt: number | null;
  remaining: number;
  done: boolean;
}
const timers = signal<Timer[]>([]);
const now = signal(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;
function ensureTick() {
  if (tick) return;
  tick = setInterval(() => {
    now.value = Date.now();
    let ring = false;
    const next = timers.value.map((t) => {
      if (t.endAt && !t.done && t.endAt <= Date.now()) {
        ring = true;
        return { ...t, done: true, endAt: null, remaining: 0 };
      }
      return t;
    });
    if (ring) {
      timers.value = next;
      startAlarm();
      const t = next.find((x) => x.done);
      notify("⏰ Minuteur terminé", t ? t.label : "");
    }
    if (!timers.value.some((t) => t.endAt || t.done)) {
      clearInterval(tick!);
      tick = null;
    }
  }, 250);
}
const left = (t: Timer) => (t.endAt ? Math.max(0, (t.endAt - now.value) / 1000) : t.remaining);
function startTimer(id: string, label: string, seconds: number) {
  unlockAudio();
  requestNotify();
  const ex = timers.value.find((t) => t.id === id);
  if (ex) {
    timers.value = timers.value.map((t) => (t.id === id ? { ...t, endAt: Date.now() + t.remaining * 1000, done: false } : t));
  } else timers.value = [...timers.value, { id, label, total: seconds, remaining: seconds, endAt: Date.now() + seconds * 1000, done: false }];
  ensureTick();
}
function pauseTimer(id: string) {
  timers.value = timers.value.map((t) => (t.id === id && t.endAt ? { ...t, remaining: Math.max(0, (t.endAt - Date.now()) / 1000), endAt: null } : t));
}
function addTime(id: string, delta: number, base: number, label: string) {
  const ex = timers.value.find((t) => t.id === id);
  if (!ex) {
    // pas encore lancé : on ajuste la durée prévue
    timers.value = [...timers.value, { id, label, total: Math.max(30, base + delta), remaining: Math.max(30, base + delta), endAt: null, done: false }];
    return;
  }
  timers.value = timers.value.map((t) => {
    if (t.id !== id) return t;
    if (t.endAt) return { ...t, endAt: Math.max(Date.now() + 5000, t.endAt + delta * 1000), total: t.total + delta };
    return { ...t, remaining: Math.max(30, t.remaining + delta), total: Math.max(30, t.total + delta), done: false };
  });
}
function dismissTimer(id: string) {
  timers.value = timers.value.filter((t) => t.id !== id);
  if (!timers.value.some((t) => t.done)) stopAlarm();
}
function clearAllTimers() {
  timers.value = [];
  stopAlarm();
}

function Ring({ frac, label }: { frac: number; label: string }) {
  const C = 2 * Math.PI * 42;
  return (
    <div class="ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" stroke-width="8" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset .25s linear" }} />
      </svg>
      <span class="t">{label}</span>
    </div>
  );
}

function StepTimer({ id, label, seconds }: { id: string; label: string; seconds: number }) {
  const t = timers.value.find((x) => x.id === id);
  const total = t ? t.total : seconds;
  const rest = t ? left(t) : seconds;
  const running = !!(t && t.endAt);
  return (
    <div class={"timer" + (t && t.done ? " ringing" : "")}>
      <Ring frac={total ? rest / total : 0} label={fmtClock(rest)} />
      <div class="stack grow" style={{ gap: 8 }}>
        <b>{t && t.done ? "⏰ C'est prêt !" : running ? "Minuteur en cours" : "Minuteur de l'étape"}</b>
        <div class="row wrap">
          {t && t.done ? (
            <button class="btn primary sm" onClick={() => dismissTimer(id)}>
              Arrêter la sonnerie
            </button>
          ) : running ? (
            <button class="btn sm" onClick={() => pauseTimer(id)}>
              <Icon name="pause" /> Pause
            </button>
          ) : (
            <button class="btn primary sm" onClick={() => startTimer(id, label, t ? t.remaining : seconds)}>
              <Icon name="play" /> {t ? "Reprendre" : "Lancer " + fmtClock(seconds)}
            </button>
          )}
          <button class="btn sm" onClick={() => addTime(id, -60, seconds, label)} aria-label="Une minute de moins">
            −1 min
          </button>
          <button class="btn sm" onClick={() => addTime(id, 60, seconds, label)} aria-label="Une minute de plus">
            +1 min
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookMode({ o }: { o: Extract<Overlay, { kind: "cook" }> }) {
  const r = findRecipe(o.id);
  const [step, setStep] = useState(0); // 0 = mise en place
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const voix = settings.value.voix;
  useEffect(() => {
    void acquireWake();
    const vis = () => document.visibilityState === "visible" && acquireWake();
    document.addEventListener("visibilitychange", vis);
    return () => {
      releaseWake();
      stopSpeaking();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  const steps = r ? viewFor(r).etapes.filter(Boolean) : [];
  const n = steps.length;
  const text = step > 0 ? steps[step - 1] || "" : "";
  useEffect(() => {
    if (voix && step > 0 && text) speak("Étape " + step + ". " + text);
  }, [step, voix]);
  if (!r) return null;
  const factor = o.portions / (r.portions || 1);
  const ings = step > 0 ? stepIngredients(text, r.ing) : [];
  const dur = step > 0 ? parseDuration(text) : 0;
  const tid = r.id + ":" + step;
  const others = timers.value.filter((t) => t.id !== tid);
  const finish = () => {
    closeOverlay();
    clearAllTimers();
    setTimeout(() => openSheet("cooked", { id: r.id, portions: o.portions, fromCook: true }), 250);
  };
  return (
    <div class="cook" role="dialog" aria-label={"Mode cuisine : " + r.nom}>
      <div class="cook-top">
        <button
          class="iconbtn"
          aria-label="Quitter le mode cuisine"
          onClick={() => {
            closeOverlay();
          }}
        >
          <Icon name="close" />
        </button>
        <div class="grow">
          <b style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nom}</b>
          <span class="small muted">{step === 0 ? "Mise en place" : "Étape " + step + " sur " + n}</span>
        </div>
        {canSpeak() && (
          <button
            class={"iconbtn" + (voix ? " on" : "")}
            style={voix ? { color: "var(--ok)" } : {}}
            aria-pressed={voix}
            aria-label={voix ? "Couper la lecture à voix haute" : "Lire les étapes à voix haute"}
            onClick={() => {
              settings.value = { ...settings.value, voix: !voix };
              if (voix) stopSpeaking();
              else if (step > 0) speak(text);
            }}
          >
            <Icon name={voix ? "volume" : "mute"} />
          </button>
        )}
      </div>
      <div class="cook-prog">
        <i style={{ width: Math.round((step / n) * 100) + "%" }} />
      </div>
      {others.length > 0 && (
        <div class="row wrap" style={{ padding: "8px var(--gutter) 0" }}>
          {others.map((t) => (
            <button class={"tag " + (t.done ? "danger" : "accent")} onClick={() => (t.done ? dismissTimer(t.id) : null)}>
              ⏱ {t.label} · {t.done ? "terminé ✕" : fmtClock(left(t))}
            </button>
          ))}
        </div>
      )}
      <div class="cook-body">
        {step === 0 ? (
          <div>
            <h2 style={{ fontSize: 26 }}>Avant de commencer</h2>
            <p class="muted mt-s">Sors tout ce qu'il faut. Touche un ingrédient quand il est prêt.</p>
            <ul class="ings miseplace mt">
              {r.ing.map((i, k) => (
                <li class={checked[k] ? "ok" : ""} onClick={() => setChecked({ ...checked, [k]: !checked[k] })}>
                  <span class={"st " + (checked[k] ? "have" : "missing")}>{checked[k] ? "✓" : ""}</span>
                  <span class="em">{emojiOf(i.n)}</span>
                  <span class="nm">{cap(i.n)}</span>
                  <span class="q">{qtyLabel(i, factor)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div key={step}>
            <div class="cook-no">Étape {step}</div>
            <p class="cook-step">{text}</p>
            {ings.length > 0 && (
              <div class="panel mt">
                <b class="small">🧺 Pour cette étape</b>
                {ings.map((g) => (
                  <div class="kv">
                    <span>
                      {emojiOf(g.n)} {cap(g.n)}
                    </span>
                    <b>{qtyLabel(g, factor)}</b>
                  </div>
                ))}
              </div>
            )}
            {dur > 0 && <StepTimer id={tid} label={"Étape " + step} seconds={dur} />}
            {voix && (
              <button class="btn ghost sm mt" onClick={() => speak(text)}>
                <Icon name="volume" /> Relire l'étape
              </button>
            )}
          </div>
        )}
      </div>
      <div class="cook-nav">
        <button class="btn lg" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <Icon name="back" /> Précédent
        </button>
        {step < n ? (
          <button class="btn primary lg" onClick={() => setStep(step + 1)}>
            {step === 0 ? "C'est parti" : "Suivant"} <Icon name="chevron" />
          </button>
        ) : (
          <button class="btn accent lg" onClick={finish}>
            ✅ Terminé
          </button>
        )}
      </div>
    </div>
  );
}
