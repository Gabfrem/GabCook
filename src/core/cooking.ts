/* Mode cuisine : durées dans le texte des étapes, ingrédients cités. */
import type { Ingredient } from "./recipe";
import { keywords, norm, sing } from "./text";

/** Repère une durée dans le texte d'une étape → secondes (0 si aucune). */
export function parseDuration(text: string): number {
  const t = norm(text);
  let m = t.match(/(\d+)\s*h\s*(\d{2})\b/); // 1h30 / 1 h 30
  if (m) return +m[1] * 3600 + +m[2] * 60;
  m = t.match(/(\d+)\s*(?:h|heures?)\b/); // 1h / 2 heures (+ « et demie »)
  if (m) {
    let s = +m[1] * 3600;
    const mm = t.match(/(?:h|heures?)\s*(?:et\s*)?(\d{1,2})\s*(?:minutes?|min|mn)?\b/);
    if (mm) s += +mm[1] * 60;
    else if (/demie?/.test(t)) s += 1800;
    return s;
  }
  // « 25 à 28 min » : on prend la borne basse, on pourra rallonger
  m = t.match(/(\d+)\s*(?:a|-)\s*\d+\s*(?:minutes?|min|mn)\b/);
  if (m) return +m[1] * 60;
  m = t.match(/(\d+)\s*(?:minutes?|min|mn)\b/);
  if (m) return +m[1] * 60;
  m = t.match(/(\d+)\s*(?:secondes?|sec)\b/);
  if (m) return +m[1];
  return 0;
}

export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600),
    mn = Math.floor((sec % 3600) / 60),
    s = sec % 60,
    p = (n: number) => String(n).padStart(2, "0");
  return h ? h + ":" + p(mn) + ":" + p(s) : p(mn) + ":" + p(s);
}

export function fmtDuree(min: number): string {
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60),
    m = min % 60;
  return h + " h" + (m ? " " + String(m).padStart(2, "0") : "");
}

/** Ingrédients de la recette cités dans le texte de l'étape. */
export function stepIngredients(text: string, ings: Ingredient[]): Ingredient[] {
  const words = new Set(
    norm(text)
      .split(" ")
      .map(sing)
      .filter((w) => w.length > 2)
  );
  return (ings || []).filter((i) => keywords(i.n).some((w) => words.has(w)));
}
