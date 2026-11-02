import { beforeEach, describe, expect, it, vi } from "vitest";

/* Base Supabase factice : juste ce que lit loadCommunityRecipes. */
const tables: Record<string, any[]> = { recipes: [], profiles: [] };
vi.mock("../src/services/supabase", () => {
  const query = (rows: any[]) => {
    const q: any = {
      select: () => q,
      order: () => q,
      limit: () => q,
      in: (col: string, vals: string[]) => query(rows.filter((r) => vals.includes(r[col]))),
      then: (ok: (v: { data: any[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok)
    };
    return q;
  };
  return { sb: { from: (t: string) => query(tables[t] || []) }, CLOUD_ON: true, ADMINS: [], SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
});

// le magasin d'état touche au DOM au chargement (thème, sauvegarde en arrière-plan)
const rien = () => {};
Object.assign(globalThis, {
  document: { documentElement: { setAttribute: rien, removeAttribute: rien }, querySelector: () => null, addEventListener: rien, visibilityState: "visible" },
  matchMedia: () => ({ matches: false, addEventListener: rien, removeEventListener: rien }),
  addEventListener: rien,
  removeEventListener: rien,
  location: { origin: "https://yummly.fr", pathname: "/", search: "", hash: "", href: "https://yummly.fr/" },
  history: { state: null, length: 1, pushState: rien, replaceState: rien, back: rien, go: rien }
});

const { communityRecipes, friends, loadCommunityRecipes } = await import("../src/services/social");
const { user } = await import("../src/state/store");

const recette = (nom: string, extra: Record<string, unknown> = {}) => ({
  nom,
  emoji: "🍲",
  cat: "Plat",
  diff: "Facile",
  prep: 10,
  cuisson: 20,
  portions: 4,
  ing: [{ q: 200, u: "g", n: "riz" }],
  etapes: ["Faites cuire le riz."],
  ...extra
});

describe("recettes de la communauté", () => {
  beforeEach(() => {
    user.value = { id: "moi", email: "moi@exemple.fr" } as any;
    friends.value = [{ id: "ami-prive", pseudo: "Ami", avatar: "" }];
    tables.profiles = [
      { id: "moi", pseudo: "Moi", is_private: false },
      { id: "public", pseudo: "Léa", is_private: false },
      { id: "prive", pseudo: "Secret", is_private: true },
      { id: "ami-prive", pseudo: "Ami", is_private: true }
    ];
    tables.recipes = [
      { id: "perso-1", author: "public", author_name: "Léa", data: recette("Riz de Léa") },
      { id: "perso-2", author: "prive", author_name: "Secret", data: recette("Riz caché") },
      { id: "perso-3", author: "ami-prive", author_name: "Ami", data: recette("Riz de mon ami") },
      { id: "perso-4", author: "moi", author_name: "Moi", data: recette("Mon riz") },
      { id: "perso-5", author: "public", author_name: "Léa", data: recette("riz de léa") },
      { id: "perso-6", author: "public", author_name: "Léa", data: { nom: "Sans étapes", ing: [] } },
      { id: "perso-7", author: "public", author_name: "Léa", data: recette("Lien piégé", { srcUrl: "javascript:alert(1)", photo: "javascript:alert(1)" }) }
    ];
  });

  it("montre les profils publics et les amis, jamais les profils privés ni mes propres recettes", async () => {
    await loadCommunityRecipes();
    const noms = communityRecipes.value.map((r) => r.nom);
    expect(noms).toContain("Riz de Léa");
    expect(noms).toContain("Riz de mon ami");
    expect(noms).not.toContain("Riz caché");
    expect(noms).not.toContain("Mon riz");
  });

  it("écarte les doublons et les recettes incomplètes, et nettoie les liens", async () => {
    await loadCommunityRecipes();
    const list = communityRecipes.value;
    expect(list.filter((r) => r.nom.toLowerCase() === "riz de léa")).toHaveLength(1);
    expect(list.some((r) => r.nom === "Sans étapes")).toBe(false);
    const piege = list.find((r) => r.nom === "Lien piégé")!;
    expect(piege.srcUrl).toBe("");
    expect(piege.photo).toBe("");
  });

  it("s'ouvre en aperçu, crédité au pseudo de l'auteur", async () => {
    await loadCommunityRecipes();
    const r = communityRecipes.value.find((x) => x.nom === "Riz de Léa")!;
    expect(r._preview).toBe(true);
    expect(r.perso).toBe(false);
    expect(r.credit).toBe("Léa");
  });
});
