/* Compile data/recettes/*.txt en src/data/catalog.json, avec contrôles :
   identifiants uniques, adaptations air fryer / micro-ondes rattachées à une recette
   existante et à des étapes qui existent. Lancé automatiquement par « npm run build ». */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "./recipe-format.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data/recettes");
const ORDRE = ["plats", "entrees", "accompagnements", "desserts", "aperos", "petits-dejeuners"];
const fichiers = fs.readdirSync(dir).filter((f) => f.endsWith(".txt"))
  .sort((a, b) => (ORDRE.indexOf(a.replace(".txt", "")) + 99) % 99 - (ORDRE.indexOf(b.replace(".txt", "")) + 99) % 99 || a.localeCompare(b));

const recettes = [];
for (const f of fichiers) recettes.push(...parse(fs.readFileSync(path.join(dir, f), "utf8"), f));

const erreurs = [];
const ids = new Map();
for (const r of recettes) {
  if (!/^[a-z0-9-]+$/.test(r.id)) erreurs.push(`identifiant invalide « ${r.id} » (minuscules, chiffres, tirets)`);
  if (ids.has(r.id)) erreurs.push(`identifiant en double « ${r.id} »`);
  ids.set(r.id, r);
}
for (const [fichier, table] of [["airfryer.json", "air fryer"], ["microondes.json", "micro-ondes"]]) {
  const data = JSON.parse(fs.readFileSync(path.join(root, "data", fichier), "utf8"));
  for (const [id, a] of Object.entries(data)) {
    const r = ids.get(id);
    if (!r) { erreurs.push(`${table} : recette inconnue « ${id} »`); continue; }
    for (const k of Object.keys(a.s || {})) if (+k >= r.etapes.length) erreurs.push(`${table} : « ${id} » réécrit l'étape ${k} qui n'existe pas`);
  }
}
if (erreurs.length) {
  console.error("✗ Catalogue invalide :\n  - " + erreurs.join("\n  - "));
  process.exit(1);
}
fs.mkdirSync(path.join(root, "src/data"), { recursive: true });
const out = recettes.map((r) => {
  const o = { id: r.id, nom: r.nom, emoji: r.emoji, cat: r.cat, prep: r.prep, cuisson: r.cuisson, portions: r.portions, diff: r.diff, ing: r.ing.map((i) => ({ q: i.q, u: i.u, n: i.n })), etapes: r.etapes };
  if (r.photo) o.photo = r.photo;
  if (r.nouveau) o.nouveau = true;
  return o;
});
fs.writeFileSync(path.join(root, "src/data/catalog.json"), JSON.stringify(out));
for (const f of ["airfryer.json", "microondes.json"]) fs.copyFileSync(path.join(root, "data", f), path.join(root, "src/data", f));
const avecPhoto = out.filter((r) => r.photo).length;
console.log(`✓ ${out.length} recettes (${avecPhoto} avec photo) → src/data/catalog.json`);
