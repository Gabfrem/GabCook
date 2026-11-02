import { describe, expect, it } from "vitest";
import { aisleOf, emojiOf, featuredEmojis } from "../src/core/catalog";
import { cuisineDe, familleRepas, isVege, respectsDiet } from "../src/core/classify";
import { fmtClock, parseDuration, stepIngredients } from "../src/core/cooking";
import { addDays, addToFridge, debitFridge, freshness, ingStatus, missingFor, type FridgeItem } from "../src/core/fridge";
import { canonIngredient, pantryName, sameProduct, separeQuantite } from "../src/core/ingredients";
import { extractRecipeJsonLd, parseIngredientLine, recipeFromJsonLd } from "../src/core/jsonld";
import { decodeRecipe, decodeSync, encodeRecipe, encodeSync, parseIncomingLink } from "../src/core/links";
import { codeBarreValide, quantiteOFF, versPieces } from "../src/core/off";
import { agendaCompte, cleJour, joursAgenda, poseRestes, poseSlot, purgeAgenda, Tirage, tirageMultiple, type Agenda } from "../src/core/planner";
import { coutIngredient, prixRecette } from "../src/core/pricing";
import { sanitizeRecipe, viewOf, type Recipe } from "../src/core/recipe";
import { matchScore, searchRecipes } from "../src/core/search";
import { isDeSaison } from "../src/core/seasons";
import { substitutsDe } from "../src/core/substitutions";
import { suggest, buildVocab } from "../src/core/suggest";
import { keywords, norm } from "../src/core/text";
import { fmtNum, niceQty, qtyLabel } from "../src/core/units";

const R = (o: Partial<Recipe>): Recipe => ({
  id: "x",
  nom: "Test",
  emoji: "🍽️",
  cat: "Plat",
  prep: 10,
  cuisson: 10,
  portions: 4,
  diff: "Facile",
  ing: [],
  etapes: ["Étape"],
  ...o
});

const carbonara = R({
  id: "carbonara",
  nom: "Pâtes à la carbonara",
  ing: [
    { q: 400, u: "g", n: "spaghetti" },
    { q: 200, u: "g", n: "lardons" },
    { q: 4, u: "", n: "œufs" },
    { q: 100, u: "g", n: "parmesan" },
    { q: 1, u: "pincée", n: "sel" }
  ]
});

describe("texte", () => {
  it("normalise les accents et ligatures", () => {
    expect(norm("Œufs brouillés")).toBe("oeufs brouilles");
    expect(keywords("2 gousses d'ail")).toEqual(["ail"]);
  });
});

describe("ingrédients", () => {
  it("ramène les variantes à un nom générique", () => {
    expect(canonIngredient("2 gousses d'ail")).toBe("ail");
    expect(canonIngredient("blanc de poulet")).toBe("poulet");
    expect(canonIngredient("oignon rouge")).toBe("oignon");
    expect(canonIngredient("pommes de terre")).toBe("pommes de terre");
    expect(canonIngredient("crème liquide")).toBe("crème");
    expect(pantryName("jaunes d'œufs")).toBe("œufs");
  });
  it("ne confond pas des produits différents", () => {
    expect(sameProduct("poivron rouge", "Poivron")).toBe(true);
    expect(sameProduct("pommes de terre", "Pommes")).toBe(false);
    expect(sameProduct("lait de coco", "Lait")).toBe(false);
    expect(sameProduct("citron vert", "Citron")).toBe(false);
    expect(sameProduct("spaghetti", "Pâtes")).toBe(true);
    expect(sameProduct("pâtes", "Spaghetti")).toBe(false);
  });
  it("sépare une quantité tapée avec le nom", () => {
    expect(separeQuantite("bœuf 500g")).toEqual({ q: 500, u: "g", n: "bœuf" });
    expect(separeQuantite("3 oignons")).toEqual({ q: 3, u: "", n: "oignons" });
    expect(separeQuantite("2 dl de lait")).toEqual({ q: 20, u: "cl", n: "lait" });
    expect(separeQuantite("farine")).toEqual({ q: null, u: "", n: "farine" });
  });
});

describe("frigo", () => {
  const fridge: FridgeItem[] = [
    { n: "pâtes", q: 1, u: "kg" },
    { n: "lardons", q: 150, u: "g" },
    { n: "œufs", q: 6, u: "" },
    { n: "parmesan", q: null, u: "" }
  ];
  it("calcule le statut de chaque ingrédient", () => {
    expect(ingStatus(fridge, carbonara.ing[0]).s).toBe("have");
    expect(ingStatus(fridge, carbonara.ing[0]).parFamille).toBe(true);
    const lard = ingStatus(fridge, carbonara.ing[1]);
    expect(lard.s).toBe("low");
    expect(lard.short).toBe(50);
    expect(ingStatus(fridge, carbonara.ing[3]).s).toBe("have");
    expect(missingFor(fridge, carbonara).map((i) => i.n)).toEqual(["lardons", "sel"]);
  });
  it("débite le frigo sans le muter", () => {
    const { fridge: f2, changed } = debitFridge(fridge, carbonara, 1);
    expect(changed).toBe(3);
    expect(f2.find((f) => f.n === "pâtes")!.q).toBe(0.6);
    expect(f2.find((f) => f.n === "lardons")).toBeUndefined();
    expect(f2.find((f) => f.n === "œufs")!.q).toBe(2);
    expect(fridge[0].q).toBe(1);
  });
  it("cumule les quantités compatibles", () => {
    let f = addToFridge([], "2 gousses d'ail", 2, "");
    f = addToFridge(f, "ail", 1, "");
    expect(f).toHaveLength(1);
    expect(f[0].q).toBe(3);
    f = addToFridge(f, "Farine", 500, "g");
    f = addToFridge(f, "farine", 1, "kg");
    expect(f.find((x) => x.n === "farine")!.q).toBe(1500);
  });
  it("repère ce qui va périmer", () => {
    expect(freshness(addDays(-1))).toBe("expired");
    expect(freshness(addDays(0))).toBe("today");
    expect(freshness(addDays(2))).toBe("soon");
    expect(freshness(addDays(10))).toBe("ok");
    expect(freshness(null)).toBe(null);
  });
});

describe("quantités", () => {
  it("arrondit l'affichage", () => {
    expect(niceQty(66.67, "g")).toEqual({ q: 65, u: "g" });
    expect(niceQty(12.4, "g")).toEqual({ q: 12, u: "g" });
    expect(niceQty(0.35, "kg")).toEqual({ q: 350, u: "g" });
    expect(qtyLabel({ q: 3, u: "" }, 0.5)).toBe("1,5");
    expect(fmtNum(2.5)).toBe("2,5");
  });
});

describe("prix", () => {
  it("ne facture pas le bœuf haché comme des œufs", () => {
    const c = coutIngredient({ q: 500, u: "g", n: "bœuf haché" })!;
    expect(c).toBeGreaterThan(4);
  });
  it("estime un prix par personne raisonnable", () => {
    const p = prixRecette(carbonara);
    expect(p.parPers).toBeGreaterThan(0.5);
    expect(p.parPers).toBeLessThan(5);
  });
});

describe("classement", () => {
  it("détecte la cuisine et le régime", () => {
    expect(cuisineDe(carbonara)).toBe("ital");
    expect(isVege(carbonara)).toBe(false);
    expect(isVege(R({ ing: [{ q: 1, u: "", n: "pâte brisée" }, { q: 3, u: "", n: "poireaux" }] }))).toBe(true);
    expect(familleRepas(carbonara)).toBe("porc");
    expect(respectsDiet(carbonara, { allerg: ["oeuf"], deteste: [] })).toBe(false);
    expect(respectsDiet(carbonara, { vege: true, allerg: [], deteste: [] })).toBe(false);
  });
  it("associe icône et rayon", () => {
    expect(emojiOf("bœuf haché")).toBe("🥩");
    expect(emojiOf("œufs")).toBe("🥚");
    expect(aisleOf("crème fraîche")).toBe("cremerie");
    expect(aisleOf("pommes de terre")).toBe("fruits-legumes");
    expect(featuredEmojis(carbonara.ing)).toEqual(["🍝", "🥓", "🥚", "🧀"]);
  });
  it("connaît les saisons", () => {
    const tomates = R({ ing: [{ q: 4, u: "", n: "tomates" }] });
    expect(isDeSaison(tomates, 7)).toBe(true);
    expect(isDeSaison(tomates, 1)).toBe(false);
  });
  it("propose des remplacements", () => {
    expect(substitutsDe("crème fraîche").length).toBeGreaterThan(0);
    expect(substitutsDe("lardons fumés")[0]).toMatch(/jambon/);
  });
});

describe("mode cuisine", () => {
  it("repère les durées", () => {
    expect(parseDuration("Laissez mijoter 20 min à couvert")).toBe(1200);
    expect(parseDuration("Cuire 1h30 au four")).toBe(5400);
    expect(parseDuration("Lancez 25 à 28 min à 170°C")).toBe(1500);
    expect(parseDuration("Mélangez")).toBe(0);
    expect(fmtClock(5400)).toBe("1:30:00");
  });
  it("retrouve les ingrédients cités", () => {
    expect(stepIngredients("Battez les œufs avec le parmesan", carbonara.ing).map((i) => i.n)).toEqual(["œufs", "parmesan"]);
  });
});

describe("liens", () => {
  it("encode et relit une recette", () => {
    const r = sanitizeRecipe({ ...carbonara, id: "perso-1" })!;
    const back = decodeRecipe(encodeRecipe(r))!;
    expect(back.nom).toBe(r.nom);
    expect(back.ing).toEqual(r.ing);
  });
  it("encode et relit un frigo", () => {
    const d = decodeSync(encodeSync([{ n: "lait", q: 1, u: "l", exp: "2026-12-01" }], [{ label: "Beurre", base: "beurre", q: 250, u: "g", from: "", checked: true }]))!;
    expect(d.fridge[0]).toEqual({ n: "lait", q: 1, u: "l", exp: "2026-12-01" });
    expect(d.shopping[0].checked).toBe(true);
  });
  it("comprend un lien collé", () => {
    expect(parseIncomingLink("https://yummly.fr/?r=carbonara&p=2").r).toBe("carbonara");
    expect(parseIncomingLink("blabla ?sync=abc").sync).toBe("abc");
  });
});

describe("import web", () => {
  it("lit les lignes d'ingrédients", () => {
    expect(parseIngredientLine("200 g de crème fraîche")).toEqual({ q: 200, u: "g", n: "crème fraîche" });
    expect(parseIngredientLine("2 cuillères à soupe d'huile d'olive")).toEqual({ q: 2, u: "c. à soupe", n: "huile d'olive" });
    expect(parseIngredientLine("½ citron")).toEqual({ q: 0.5, u: "", n: "citron" });
    expect(parseIngredientLine("1,5 l de lait")).toEqual({ q: 1.5, u: "l", n: "lait" });
    expect(parseIngredientLine("sel, poivre")).toEqual({ q: null, u: "", n: "sel, poivre" });
  });
  it("trouve la recette JSON-LD d'une page", () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Quiche","recipeYield":"6 personnes","prepTime":"PT15M","cookTime":"PT35M","recipeIngredient":["3 œufs","20 cl de crème"],"recipeInstructions":[{"@type":"HowToStep","text":"Battre."},{"@type":"HowToStep","text":"Cuire."}],"image":["https://x/y.jpg"]}]}</script></head></html>`;
    const rec = recipeFromJsonLd(extractRecipeJsonLd(html)!);
    expect(rec.nom).toBe("Quiche");
    expect(rec.portions).toBe(6);
    expect(rec.cuisson).toBe(35);
    expect(rec.ing[1]).toEqual({ q: 20, u: "cl", n: "crème" });
    expect(rec.etapes).toEqual(["Battre.", "Cuire."]);
  });
});

describe("scanner", () => {
  it("valide les codes-barres", () => {
    expect(codeBarreValide("3017620422003")).toBe(true);
    expect(codeBarreValide("3017620422004")).toBe(false);
  });
  it("lit les quantités Open Food Facts", () => {
    expect(quantiteOFF("6 x 125 g")).toEqual({ q: 750, u: "g" });
    expect(quantiteOFF("1 L")).toEqual({ q: 1, u: "l" });
    expect(quantiteOFF("6 œufs")).toEqual({ q: 6, u: "" });
    expect(versPieces("poivrons", 500, "g")).toEqual({ q: 3, u: "" });
  });
});

describe("planning", () => {
  const today = new Date(2026, 10, 2, 10);
  const j = joursAgenda(today).map(cleJour);
  it("décale les plats quand on mange les restes", () => {
    let a: Agenda = {};
    a = poseSlot(a, j[0], "soir", { t: "r", id: "a" });
    a = poseSlot(a, j[1], "midi", { t: "r", id: "b" });
    const res = poseRestes(a, j[0], "soir", today);
    expect(res.decale).toBe(2);
    expect(res.agenda[j[0]].soir).toEqual({ t: "restes" });
    expect(res.agenda[j[1]].midi).toEqual({ t: "r", id: "a" });
    expect(res.agenda[j[1]].soir).toEqual({ t: "r", id: "b" });
    expect(agendaCompte(res.agenda, today)).toBe(2);
  });
  it("oublie les jours passés", () => {
    const a: Agenda = { "2020-01-01": { midi: { t: "restes" } }, [j[2]]: { soir: { t: "restes" } } };
    expect(Object.keys(purgeAgenda(a, today))).toEqual([j[2]]);
  });
  it("varie les familles de plats", () => {
    const list: Recipe[] = [];
    for (let i = 0; i < 10; i++) list.push(R({ id: "p" + i, nom: "Poulet " + i, ing: [{ q: 1, u: "", n: "poulet" }] }));
    for (let i = 0; i < 10; i++) list.push(R({ id: "s" + i, nom: "Saumon " + i, ing: [{ q: 1, u: "", n: "saumon" }] }));
    for (let i = 0; i < 10; i++) list.push(R({ id: "l" + i, nom: "Lentilles " + i, ing: [{ q: 1, u: "", n: "lentilles" }] }));
    const pick = tirageMultiple(list, 6, 0, () => 5, new Tirage());
    expect(pick).toHaveLength(6);
    const fams = pick.map((r) => r.id[0]);
    expect(fams.filter((f) => f === "p").length).toBeLessThanOrEqual(2);
    expect(fams.filter((f) => f === "s").length).toBeLessThanOrEqual(2);
  });
});

describe("recherche", () => {
  const list = [carbonara, R({ id: "tarte", nom: "Tarte courgette et feta", ing: [{ q: 2, u: "", n: "courgettes" }, { q: 200, u: "g", n: "feta" }] })];
  it("tolère les fautes", () => {
    expect(searchRecipes(list, "carbonarra")[0].id).toBe("carbonara");
  });
  it("cherche plusieurs ingrédients", () => {
    expect(searchRecipes(list, "courgette, feta").map((r) => r.id)).toEqual(["tarte"]);
    expect(matchScore(carbonara, "courgette, feta")).toBe(0);
  });
  it("suggère des ingrédients", () => {
    const vocab = buildVocab(["oignons", "oignon rouge", "ail", "beurre", "bœuf haché", "bœuf"]);
    expect(suggest(vocab, "ognon")[0]).toBe("Oignon");
    expect(suggest(vocab, "onion")[0]).toMatch(/^Oignons?$/);
    expect(suggest(vocab, "beuf")[0]).toBe("Bœuf");
  });
});

describe("modes de cuisson", () => {
  it("réécrit les étapes en mode air fryer", () => {
    const r = R({ id: "quiche", etapes: ["a", "b", "c"] });
    const v = viewOf(r, "airfryer", { quiche: { four: 1, t: 170, min: 30, s: { 1: "B" } } }, {});
    expect(v.etapes).toEqual(["a", "B", "c"]);
    expect(v.cuisson).toBe(30);
    expect(viewOf(r, "normal", {}, {}).etapes).toEqual(["a", "b", "c"]);
  });
});
