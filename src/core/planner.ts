/* ==========================================================================
   AGENDA DE LA SEMAINE : aujourd'hui + 7 jours, deux repas par jour.
   Un créneau contient une recette, « les restes », ou rien.
   agenda = { "2026-08-17": { midi: {t:"r", id:"carbonara"}, soir: {t:"restes"} } }
   Toutes les fonctions sont pures : elles renvoient un nouvel agenda.
   ========================================================================== */
import { familleRepas } from "./classify";
import type { Recipe } from "./recipe";

export type Meal = "midi" | "soir";
export const REPAS: Meal[] = ["midi", "soir"];
export type Slot = { t: "r"; id: string; gen?: boolean; portions?: number } | { t: "restes" };
export type Agenda = Record<string, Partial<Record<Meal, Slot>>>;

export const JOURS_CT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const JOURS_LONG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const MOIS_CT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function cleJour(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function joursAgenda(today = new Date(), n = 8): Date[] {
  const out: Date[] = [];
  const base = new Date(today);
  base.setHours(12, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}
export interface Creneau {
  cle: string;
  repas: Meal;
  date: Date;
}
/** Tous les créneaux dans l'ordre chronologique (c'est cet ordre qui sert au décalage). */
export function creneaux(today = new Date()): Creneau[] {
  const out: Creneau[] = [];
  joursAgenda(today).forEach((d) => {
    const c = cleJour(d);
    REPAS.forEach((rp) => out.push({ cle: c, repas: rp, date: d }));
  });
  return out;
}
export const slotDe = (a: Agenda, cle: string, repas: Meal): Slot | null => (a[cle] && a[cle][repas]) || null;

export function poseSlot(a: Agenda, cle: string, repas: Meal, slot: Slot | null): Agenda {
  const next: Agenda = { ...a, [cle]: { ...(a[cle] || {}) } };
  if (slot) next[cle][repas] = slot;
  else delete next[cle][repas];
  if (!Object.keys(next[cle]).length) delete next[cle];
  return next;
}

/** Les jours passés disparaissent : l'agenda glisse tout seul avec le temps. */
export function purgeAgenda(a: Agenda, today = new Date()): Agenda {
  const min = cleJour(joursAgenda(today)[0]);
  const next: Agenda = {};
  Object.keys(a).forEach((k) => {
    if (k >= min) next[k] = a[k];
  });
  return next;
}

/** « On a mangé les restes » : le plat prévu glisse au repas suivant, en poussant
 *  devant lui ce qui s'y trouvait déjà. */
export function poseRestes(a: Agenda, cle: string, repas: Meal, today = new Date()): { agenda: Agenda; decale: number; perdu: number } {
  const liste = creneaux(today);
  const i = liste.findIndex((c) => c.cle === cle && c.repas === repas);
  if (i < 0) return { agenda: a, decale: 0, perdu: 0 };
  let porte = slotDe(a, cle, repas);
  let next = poseSlot(a, cle, repas, { t: "restes" });
  let decale = 0,
    perdu = 0;
  for (let k = i + 1; porte && porte.t === "r"; k++) {
    if (k >= liste.length) {
      perdu++;
      break;
    }
    const c = liste[k],
      suivant = slotDe(next, c.cle, c.repas);
    next = poseSlot(next, c.cle, c.repas, porte);
    decale++;
    porte = suivant && suivant.t === "r" ? suivant : null;
  }
  return { agenda: next, decale, perdu };
}

/** Recettes présentes dans l'agenda, sans doublon, dans l'ordre chronologique. */
export function recettesAgenda(a: Agenda, today = new Date()): string[] {
  const ids: string[] = [];
  creneaux(today).forEach((c) => {
    const s = slotDe(a, c.cle, c.repas);
    if (s && s.t === "r" && !ids.includes(s.id)) ids.push(s.id);
  });
  return ids;
}
export function agendaCompte(a: Agenda, today = new Date()): number {
  let n = 0;
  creneaux(today).forEach((c) => {
    const s = slotDe(a, c.cle, c.repas);
    if (s && s.t === "r") n++;
  });
  return n;
}
/** Prochain repas planifié (à partir de maintenant : le midi d'aujourd'hui est passé après 15 h). */
export function prochainRepas(a: Agenda, now = new Date()): (Creneau & { id: string }) | null {
  const list = creneaux(now);
  const skipMidi = now.getHours() >= 15;
  for (const c of list) {
    if (c.cle === cleJour(now) && c.repas === "midi" && skipMidi) continue;
    const s = slotDe(a, c.cle, c.repas);
    if (s && s.t === "r") return { ...c, id: s.id };
  }
  return null;
}
export function libelleJour(d: Date, i: number): string {
  if (i === 0) return "Aujourd'hui";
  if (i === 1) return "Demain";
  return JOURS_CT[d.getDay()] + " " + d.getDate();
}

/* ---------- tirage varié ----------
   Tirage pondéré (les mieux notés sortent un peu plus souvent) + mémoire courte des
   derniers proposés pour ne pas tourner en rond. */
export class Tirage {
  private recents: string[] = [];
  constructor(private poids: (r: Recipe) => number = () => 1, private rand: () => number = Math.random) {}
  pick(liste: Recipe[]): Recipe | null {
    if (!liste.length) return null;
    const frais = liste.filter((r) => !this.recents.includes(r.id));
    const pool = frais.length ? frais : liste;
    const w = pool.map((r) => Math.max(0.05, this.poids(r)));
    const total = w.reduce((x, y) => x + y, 0);
    let t = this.rand() * total,
      i = 0;
    while (i < pool.length - 1 && t > w[i]) {
      t -= w[i];
      i++;
    }
    const r = pool[i];
    this.recents.push(r.id);
    const maxi = Math.max(3, Math.min(60, Math.floor(liste.length * 0.5)));
    while (this.recents.length > maxi) this.recents.shift();
    return r;
  }
}

/** Tire `nb` plats variés, sans doublon : au plus ⌈nb/3⌉ plats d'une même famille
 *  (poisson, volaille, pâtes…), et sous le budget s'il y en a un.
 *  Contrairement à la v1, on ne complète plus « au moins cher » (qui ramenait toujours
 *  les mêmes plats) : on relâche d'abord la variété, puis le budget. */
export function tirageMultiple(liste: Recipe[], nb: number, budget: number, cout: (r: Recipe) => number, tirage: Tirage): Recipe[] {
  const maxFam = Math.max(1, Math.ceil(nb / 3));
  const choix: Recipe[] = [];
  const fam: Record<string, number> = {};
  let total = 0;
  const essai = (respecteFam: boolean, respecteBudget: boolean) => {
    let reste = liste.filter((r) => !choix.includes(r));
    while (choix.length < nb && reste.length) {
      const r = tirage.pick(reste);
      if (!r) break;
      reste = reste.filter((x) => x.id !== r.id);
      const f = familleRepas(r);
      if (respecteFam && (fam[f] || 0) >= maxFam) continue;
      const c = cout(r);
      if (respecteBudget && budget && total + c > budget) continue;
      choix.push(r);
      fam[f] = (fam[f] || 0) + 1;
      total += c;
    }
  };
  essai(true, true);
  if (choix.length < nb) essai(false, true);
  if (choix.length < nb && budget) {
    // le budget est trop serré : on complète au hasard parmi les moins chers
    let moinsChers = liste
      .filter((r) => !choix.includes(r))
      .sort((a, b) => cout(a) - cout(b))
      .slice(0, Math.max(10, nb * 3));
    while (choix.length < nb && moinsChers.length) {
      const r = tirage.pick(moinsChers);
      if (!r) break;
      moinsChers = moinsChers.filter((x) => x.id !== r.id);
      choix.push(r);
    }
  }
  return choix;
}
