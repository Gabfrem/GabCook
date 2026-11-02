/* Remplacements possibles quand il manque un ingrédient : on cuisine quand même. */
import { pantryName } from "./ingredients";
import { norm } from "./text";

const SUBS: [RegExp, string[]][] = [
  [/^creme( fraiche| liquide| epaisse| entiere)?$/, ["yaourt grec ou fromage blanc (hors cuisson vive)", "lait + 1 noix de beurre pour une sauce", "crème de soja ou de coco"]],
  [/^beurre$/, ["huile d'olive ou de colza pour la cuisson", "margarine en pâtisserie", "purée d'amande (gâteaux)"]],
  [/^lait$/, ["lait végétal (avoine, soja, amande)", "moitié eau, moitié crème"]],
  [/^oeufs$/, ["en pâtisserie : 1 c. à soupe de graines de lin moulues + 3 c. à soupe d'eau par œuf", "½ banane écrasée ou 50 g de compote par œuf (gâteaux)"]],
  [/^parmesan$/, ["pecorino, grana padano", "comté ou gruyère râpé"]],
  [/^(gruyere|emmental|comte|fromage rape|fromage)$/, ["n'importe quel fromage à pâte dure râpé (comté, emmental, cheddar)", "parmesan, en plus petite quantité"]],
  [/^lardons$/, ["jambon ou bacon en dés", "poitrine fumée", "tofu fumé (version végé)"]],
  [/^vin blanc$/, ["bouillon + 1 c. à soupe de vinaigre de cidre", "jus de raisin blanc non sucré"]],
  [/^vin rouge$/, ["bouillon de bœuf + 1 c. à soupe de vinaigre balsamique", "jus de raisin rouge"]],
  [/^citron$/, ["citron vert", "une touche de vinaigre (sauces, marinades)"]],
  [/^citron vert$/, ["citron jaune"]],
  [/^echalotes?$/, ["oignon (un peu moins)", "oignon nouveau"]],
  [/^oignons?$/, ["échalote", "poireau (blanc)"]],
  [/^ail$/, ["ail en poudre : ¼ c. à café par gousse", "échalote"]],
  [/^(persil|coriandre|basilic|ciboulette|menthe|aneth)$/, ["une autre herbe fraîche (persil ↔ coriandre)", "herbes séchées : 3 fois moins"]],
  [/^lait de coco$/, ["crème liquide + un peu de lait", "yaourt nature (hors ébullition)"]],
  [/^creme de coco$/, ["crème fraîche épaisse"]],
  [/^mascarpone$/, ["ricotta", "fromage frais type Saint-Moret"]],
  [/^ricotta$/, ["fromage blanc bien égoutté", "brousse ou fromage frais"]],
  [/^mozzarella$/, ["burrata", "emmental pour un gratin"]],
  [/^feta$/, ["fromage de chèvre frais", "ricotta salée"]],
  [/^chapelure$/, ["biscottes ou pain sec mixés", "flocons d'avoine mixés"]],
  [/^farine$/, ["maïzena pour lier une sauce (2 fois moins)", "farine de riz ou de sarrasin (sans gluten)"]],
  [/^(maizena|fecule)/, ["farine : 2 fois plus"]],
  [/^sucre$/, ["miel ou sirop d'érable (¾ de la quantité)", "sucre roux ou cassonade"]],
  [/^levure chimique$/, ["½ c. à café de bicarbonate + 1 c. à soupe de jus de citron"]],
  [/^bouillon$/, ["eau + 1 c. à soupe de sauce soja", "eau de cuisson des légumes"]],
  [/^sauce soja$/, ["sel + une pincée de sucre", "sauce worcestershire (un peu)"]],
  [/^concentre de tomates?$/, ["coulis de tomate bien réduit"]],
  [/^(tomates concassees|tomates pelees|coulis de tomate|sauce tomate)$/, ["tomates fraîches pelées et concassées", "passata"]],
  [/^courgettes?$/, ["aubergine", "poivron"]],
  [/^aubergines?$/, ["courgette"]],
  [/^epinards$/, ["blettes", "chou kale", "roquette (cru)"]],
  [/^riz (arborio|carnaroli)$/, ["riz rond"]],
  [/^yaourt grec$/, ["fromage blanc", "skyr"]],
  [/^yaourt$/, ["fromage blanc", "crème fraîche allongée de lait"]],
  [/^poulet$/, ["dinde", "porc (filet)"]],
  [/^dinde$/, ["poulet"]],
  [/^viande hachee$/, ["chair à saucisse", "lentilles cuites ou protéines de soja (version végé)"]],
  [/^(boeuf hache|steak hache)$/, ["porc ou veau haché", "lentilles cuites (version végé)"]],
  [/^crevettes$/, ["poisson blanc en dés", "calamars"]],
  [/^(cabillaud|colin|merlu|lieu|poisson blanc|dos de cabillaud)$/, ["n'importe quel poisson blanc (colin, lieu, merlu)", "poisson surgelé"]],
  [/^saumon$/, ["truite"]],
  [/^miel$/, ["sirop d'érable ou d'agave", "sucre roux"]],
  [/^pate brisee$/, ["pâte feuilletée", "pâte sablée (desserts)"]],
  [/^pate feuilletee$/, ["pâte brisée"]],
  [/^gingembre$/, ["gingembre en poudre : ¼ c. à café pour 2 cm"]],
  [/^vinaigre balsamique$/, ["vinaigre de vin + une pincée de sucre"]],
  [/^beurre de cacahuete$/, ["purée d'amande ou de cajou"]],
  [/^tortillas?$/, ["pains pita", "galettes de blé"]],
  [/^nouilles?/, ["spaghetti fins", "vermicelles de riz"]],
  [/^chorizo$/, ["merguez", "lardons + une pincée de paprika fumé"]],
  [/^(cheddar|mimolette)$/, ["emmental ou comté"]],
  [/^chocolat( noir)?$/, ["cacao en poudre + un peu de beurre"]],
  [/^cognac|rhum|calvados/, ["à omettre", "jus de pomme (flambage impossible)"]]
];

export function substitutsDe(nom: string): string[] {
  const n = norm(pantryName(nom));
  for (const [re, l] of SUBS) if (re.test(n)) return l;
  return [];
}
