import { describe, expect, it } from "vitest";
import { aggregateNeeds, byAisle, mergeItem, missingAsItems, shoppingText, type ShopItem } from "../src/core/shopping";
import type { Recipe } from "../src/core/recipe";

const R = (id: string, ing: Recipe["ing"], portions = 4): Recipe => ({ id, nom: id, emoji: "🍽️", cat: "Plat", prep: 5, cuisson: 5, portions, diff: "Facile", ing, etapes: ["x"] });

describe("liste de courses", () => {
  it("fusionne un même produit en cumulant les quantités", () => {
    let l: ShopItem[] = [];
    l = mergeItem(l, { label: "Farine", base: "farine", q: 500, u: "g", from: "" }).list;
    const r = mergeItem(l, { label: "Farine", base: "farine", q: 1, u: "kg", from: "" });
    expect(r.merged).toBe(true);
    expect(r.list).toHaveLength(1);
    expect(r.list[0].q).toBe(1500);
  });
  it("n'ajoute pas les produits de base (sel, poivre, huile)", () => {
    const r = R("a", [
      { q: 200, u: "g", n: "lardons" },
      { q: 1, u: "pincée", n: "sel" },
      { q: 2, u: "c. à soupe", n: "huile d'olive" },
      { q: 2, u: "", n: "gousses d'ail" }
    ]);
    const items = missingAsItems(r, 1, []);
    expect(items.map((i) => i.base)).toEqual(["lardons", "ail"]);
    expect(items[1].label).toBe("Ail");
  });
  it("cumule les besoins de la semaine et déduit le frigo", () => {
    const a = R("a", [{ q: 300, u: "g", n: "riz" }, { q: 2, u: "", n: "oignons" }]);
    const b = R("b", [{ q: 200, u: "g", n: "riz basmati" }, { q: 1, u: "", n: "oignon rouge" }]);
    const { items, couverts } = aggregateNeeds([{ r: a, factor: 1 }, { r: b, factor: 1 }], [{ n: "riz", q: 100, u: "g" }]);
    const riz = items.find((i) => i.base === "riz")!;
    expect(riz.q).toBe(400);
    expect(riz.from).toBe("2 plats");
    expect(items.find((i) => i.base === "oignons")!.q).toBe(3);
    expect(couverts).toBe(0);
  });
  it("classe par rayon dans l'ordre du magasin", () => {
    const l: ShopItem[] = [
      { id: 1, label: "Lait", base: "lait", q: 1, u: "l", from: "", checked: false },
      { id: 2, label: "Tomates", base: "tomates", q: 4, u: "", from: "", checked: false },
      { id: 3, label: "Poulet", base: "poulet", q: 1, u: "kg", from: "", checked: false }
    ];
    expect(byAisle(l).map((g) => g.aisle)).toEqual(["fruits-legumes", "boucherie", "cremerie"]);
    expect(shoppingText(l)).toContain("• Tomates — 4");
  });
});
