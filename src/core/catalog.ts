/* ==========================================================================
   CONNAISSANCE DES PRODUITS
   Pour chaque produit : une icône, son rayon en magasin et une durée de conservation
   indicative une fois rentré à la maison (frais seulement). Sert à :
   - classer la liste de courses par rayon (on ne fait plus d'allers-retours) ;
   - donner un visage aux articles du frigo ;
   - proposer une date limite quand on range les courses.
   ========================================================================== */
import { pantryName } from "./ingredients";
import { norm } from "./text";

export type AisleId =
  | "fruits-legumes"
  | "boucherie"
  | "poissonnerie"
  | "cremerie"
  | "boulangerie"
  | "epicerie-salee"
  | "epicerie-sucree"
  | "surgeles"
  | "boissons"
  | "autre";

export const AISLES: { id: AisleId; nom: string; emoji: string }[] = [
  { id: "fruits-legumes", nom: "Fruits & légumes", emoji: "🥬" },
  { id: "boulangerie", nom: "Boulangerie", emoji: "🥖" },
  { id: "boucherie", nom: "Boucherie & charcuterie", emoji: "🥩" },
  { id: "poissonnerie", nom: "Poissonnerie", emoji: "🐟" },
  { id: "cremerie", nom: "Crèmerie & œufs", emoji: "🧀" },
  { id: "epicerie-salee", nom: "Épicerie salée", emoji: "🥫" },
  { id: "epicerie-sucree", nom: "Épicerie sucrée", emoji: "🍫" },
  { id: "surgeles", nom: "Surgelés", emoji: "❄️" },
  { id: "boissons", nom: "Boissons", emoji: "🧃" },
  { id: "autre", nom: "Autres", emoji: "🛒" }
];

/** [motif sur le nom normalisé, icône, rayon, conservation en jours (null = placard)] */
type Rule = [RegExp, string, AisleId, number | null];
const R: Rule[] = [
  // --- produits composés à reconnaître avant leurs mots isolés ---
  [/pommes? de terre|grenailles?|patates?(?! douce)/, "🥔", "fruits-legumes", 30],
  [/patates? douces?/, "🍠", "fruits-legumes", 21],
  [/lait de coco|creme de coco/, "🥥", "epicerie-salee", null],
  [/huile d olive/, "🫒", "epicerie-salee", null],
  [/beurre de cacahuete|pate d arachide/, "🥜", "epicerie-sucree", null],
  [/sauce soja|sauce worcestershire|sauce (tomate|nuoc|poisson|huitre|piquante|sriracha)|ketchup|mayonnaise|harissa|pesto|tapenade/, "🫙", "epicerie-salee", null],
  [/concentre de tomates?|tomates? (concassees|pelees)|coulis|pulpe de tomate|passata/, "🥫", "epicerie-salee", null],
  [/tomates? (cerises?|sechees?)/, "🍅", "fruits-legumes", 7],
  [/pate (brisee|feuilletee|sablee|a pizza|a tarte)|rouleau de pate/, "🥧", "cremerie", 10],
  [/pate de curry|curry|colombo|ras el hanout|garam masala|tandoori/, "🫙", "epicerie-salee", null],
  [/fruits de mer/, "🦐", "poissonnerie", 2],
  [/lardons?|bacon|poitrine/, "🥓", "boucherie", 10],
  [/chair a saucisse|saucisses?|merguez|chipolatas?|knacks?|saucisson|chorizo|andouillettes?|boudin/, "🌭", "boucherie", 5],
  [/jambon|coppa|pancetta|speck|bresaola/, "🥓", "boucherie", 5],
  [/poulet|volaille|pilons?|ailes de poulet|cuisses? de poulet/, "🍗", "boucherie", 3],
  [/dinde/, "🦃", "boucherie", 3],
  [/canard|magret|confit/, "🍗", "boucherie", 4],
  [/viande hachee|steaks? haches?|boeuf hache|hache/, "🥩", "boucherie", 2],
  [/boeuf|veau|steaks?|rumsteck|entrecote|onglet|bavette|paleron|jarret|rosbif|roti de boeuf|joue/, "🥩", "boucherie", 3],
  [/agneau|mouton|gigot|epaule d agneau/, "🍖", "boucherie", 3],
  [/porc|echine|travers|filet mignon|cotes? de porc|roti de porc/, "🍖", "boucherie", 3],
  [/saumon fume|truite fumee/, "🍣", "poissonnerie", 7],
  [/saumon|truite/, "🍣", "poissonnerie", 2],
  [/crevettes?|gambas|langoustines?|ecrevisses?/, "🦐", "poissonnerie", 2],
  [/moules|huitres?|palourdes?|coques|saint jacques/, "🦪", "poissonnerie", 2],
  [/calamars?|seiche|encornets?|poulpe/, "🦑", "poissonnerie", 2],
  [/thon en boite|thon au naturel|sardines? en boite|maquereaux? en boite|miettes de thon/, "🥫", "epicerie-salee", null],
  [/harengs? marines?|harengs? fumes?/, "🐟", "poissonnerie", 14],
  [/thon|cabillaud|colin|merlu|lieu|poissons?|dorade|daurade|bar|sardines?|maquereaux?|harengs?|haddock|morue|eglefin|sole|lotte|anchois|merlan|surimi/, "🐟", "poissonnerie", 2],
  [/oeufs?|jaunes? d oeufs?|blancs? d oeufs?/, "🥚", "cremerie", 21],
  [/lait concentre/, "🥛", "epicerie-sucree", null],
  [/lait/, "🥛", "cremerie", 7],
  [/beurre/, "🧈", "cremerie", 30],
  [/creme/, "🥛", "cremerie", 7],
  [/yaourts?|skyr|fromage blanc|petits? suisses?|faisselle/, "🥛", "cremerie", 14],
  [/mozzarella|burrata|ricotta|mascarpone|feta|fromage frais|chevre frais|boursin|philadelphia|brousse/, "🧀", "cremerie", 7],
  [/parmesan|gruyere|emmental|comte|cantal|mimolette|raclette|reblochon|roquefort|bleu|camembert|brie|chevre|fromage|cheddar|pecorino|munster|maroilles|tomme|halloumi|gouda/, "🧀", "cremerie", 21],
  [/tofu|tempeh/, "🧈", "cremerie", 7],
  [/baguette|pain|brioche|buns?|bagels?|pita|tortillas?|wraps?|naans?|galettes? de ble|pain de mie|croissants?|focaccia/, "🥖", "boulangerie", 4],
  [/tomates?/, "🍅", "fruits-legumes", 7],
  [/oignons? nouveaux?|cebettes?|ciboules?/, "🧅", "fruits-legumes", 7],
  [/oignons?|echalotes?/, "🧅", "fruits-legumes", 30],
  [/ail/, "🧄", "fruits-legumes", 30],
  [/carottes?/, "🥕", "fruits-legumes", 21],
  [/courgettes?|concombres?|cornichons?/, "🥒", "fruits-legumes", 7],
  [/aubergines?/, "🍆", "fruits-legumes", 7],
  [/poivrons?/, "🫑", "fruits-legumes", 10],
  [/piments?|jalapenos?/, "🌶️", "fruits-legumes", 10],
  [/brocolis?|chou-fleur|chou fleur|choux? de bruxelles|romanesco/, "🥦", "fruits-legumes", 7],
  [/salade|laitue|roquette|mache|epinards?|chou|blettes?|cresson|endives?|batavia|frisee|iceberg|romaine|bok choy|pak choi/, "🥬", "fruits-legumes", 5],
  [/champignons?|cepes|girolles|shiitake|pleurotes/, "🍄", "fruits-legumes", 5],
  [/mais/, "🌽", "fruits-legumes", 5],
  [/petits pois|haricots? verts?|pois gourmands?|feves|edamame/, "🫛", "fruits-legumes", 5],
  [/lentilles|pois chiches|haricots?|flageolets|pois casses/, "🫘", "epicerie-salee", null],
  [/poireaux?|celeri|fenouil|asperges?|artichauts?|navets?|radis|betteraves?|panais|topinambours?|rutabaga/, "🥬", "fruits-legumes", 10],
  [/butternut|potiron|courges?|potimarron|citrouille/, "🎃", "fruits-legumes", 30],
  [/avocats?/, "🥑", "fruits-legumes", 5],
  [/citrons? verts?|limes?/, "🍋", "fruits-legumes", 14],
  [/citrons?/, "🍋", "fruits-legumes", 14],
  [/oranges?|clementines?|mandarines?|pamplemousses?/, "🍊", "fruits-legumes", 14],
  [/pommes?/, "🍎", "fruits-legumes", 21],
  [/poires?/, "🍐", "fruits-legumes", 7],
  [/bananes?/, "🍌", "fruits-legumes", 5],
  [/fraises?|framboises?|fruits rouges|groseilles?|mures?/, "🍓", "fruits-legumes", 3],
  [/myrtilles?|cassis/, "🫐", "fruits-legumes", 5],
  [/cerises?/, "🍒", "fruits-legumes", 4],
  [/peches?|nectarines?|abricots?|prunes?|mirabelles?/, "🍑", "fruits-legumes", 5],
  [/raisins? secs?/, "🍇", "epicerie-sucree", null],
  [/raisins?/, "🍇", "fruits-legumes", 7],
  [/mangues?/, "🥭", "fruits-legumes", 5],
  [/ananas/, "🍍", "fruits-legumes", 5],
  [/kiwis?/, "🥝", "fruits-legumes", 10],
  [/melons?|pasteques?/, "🍈", "fruits-legumes", 5],
  [/noix de coco|coco rapee/, "🥥", "epicerie-sucree", null],
  [/gingembre|citronnelle|galanga/, "🫚", "fruits-legumes", 21],
  [/persil|coriandre|basilic|menthe|ciboulette|aneth|estragon|cerfeuil|herbes fraiches/, "🌿", "fruits-legumes", 5],
  [/thym|romarin|laurier|origan|sauge|sarriette|herbes de provence|bouquet garni/, "🌿", "epicerie-salee", null],
  [/spaghetti|tagliatelle|penne|macaroni|coquillettes?|fusilli|linguine|farfalle|rigatoni|orecchiette|lasagnes?|cannellonis?|pates|vermicelles?/, "🍝", "epicerie-salee", null],
  [/tortellinis?|raviolis?|gnocchis?/, "🍝", "cremerie", 10],
  [/nouilles|ramen|udon|soba/, "🍜", "epicerie-salee", null],
  [/riz/, "🍚", "epicerie-salee", null],
  [/semoule|couscous|boulgour|quinoa|polenta|ble|sarrasin|flocons d avoine|avoine|chapelure/, "🌾", "epicerie-salee", null],
  [/farine|maizena|fecule/, "🌾", "epicerie-sucree", null],
  [/levure|bicarbonate|gelatine|agar/, "🧁", "epicerie-sucree", null],
  [/sucre|cassonade|vergeoise/, "🍬", "epicerie-sucree", null],
  [/miel|sirop/, "🍯", "epicerie-sucree", null],
  [/chocolat|cacao|pepites/, "🍫", "epicerie-sucree", null],
  [/confiture|pate a tartiner|creme de marrons?|caramel/, "🍯", "epicerie-sucree", null],
  [/vanille|cannelle|amandes?|noisettes?|noix|pistaches?|cacahuetes?|pignons?|graines?|sesame|chataignes?/, "🥜", "epicerie-sucree", null],
  [/biscuits?|speculoos|boudoirs?|madeleines?|gaufrettes?|cookies?/, "🍪", "epicerie-sucree", null],
  [/olives?|capres/, "🫒", "epicerie-salee", null],
  [/huile/, "🫗", "epicerie-salee", null],
  [/vinaigre/, "🫗", "epicerie-salee", null],
  [/moutarde/, "🫙", "epicerie-salee", null],
  [/sel|poivre|epices?|paprika|cumin|curcuma|muscade|piment d espelette|safran|cardamome|clous? de girofle|badiane|za atar|sumac|genievre/, "🧂", "epicerie-salee", null],
  [/bouillon|fond de/, "🥣", "epicerie-salee", null],
  [/glace|sorbet|surgele/, "🍦", "surgeles", null],
  [/vin|biere|cidre|cognac|rhum|porto|calvados|alcool/, "🍷", "boissons", null],
  [/jus|soda|limonade|eau gazeuse/, "🧃", "boissons", null],
  [/pousses de soja|germes de soja/, "🌱", "fruits-legumes", 4],
  [/feuilles de brick|brick/, "🫓", "cremerie", 30],
  [/feuilles de vigne|vigne/, "🍃", "epicerie-salee", null],
  [/paneer/, "🧀", "cremerie", 14],
  [/tahini|sriracha|sauce chili( douce)?/, "🫙", "epicerie-salee", null],
  [/garam massala|anis etoile|anis/, "🧂", "epicerie-salee", null],
  [/pruneaux|dattes|abricots secs|figues seches|fruits secs|cranberries sechees|cranberries/, "🌰", "epicerie-sucree", null],
  [/meringues?/, "🍥", "epicerie-sucree", null],
  [/fruits de la passion|grenades?/, "🥭", "fruits-legumes", 7],
  [/granola|muesli|cereales/, "🥣", "epicerie-sucree", null],
  [/muffins? anglais|pains? a burger|bagels?/, "🍔", "boulangerie", 5],
  [/lard/, "🥓", "boucherie", 10],
  [/choucroute/, "🥬", "boucherie", 14],
  [/pate de foie|pate de campagne|rillettes|terrine/, "🥓", "boucherie", 10],
  [/emince de kebab|kebab/, "🥙", "boucherie", 3],
  [/houmous/, "🫘", "cremerie", 7],
  [/rhubarbe/, "🥬", "fruits-legumes", 5],
  [/frites surgelees|frites?|legumes pour wok|cuisses de grenouille|grenouilles?|pate kadaif|kadaif/, "❄️", "surgeles", null],
  [/sauce blanche|pate de tamarin|tamarin|pousses de bambou|feuilles de nori|nori/, "🫙", "epicerie-salee", null],
  [/poudre a flan|guimauves?|mini guimauves/, "🍬", "epicerie-sucree", null],
  [/bretzels?/, "🥨", "epicerie-salee", null],
  [/eau/, "💧", "boissons", null],
  [/cafe|the/, "☕", "boissons", null]
];

export interface ProductInfo {
  emoji: string;
  aisle: AisleId;
  /** conservation indicative une fois à la maison (jours), null = placard */
  shelf: number | null;
}
const DEFAUT: ProductInfo = { emoji: "🍽️", aisle: "autre", shelf: null };
const _memo = new Map<string, ProductInfo>();
export function productInfo(name: string): ProductInfo {
  const k = norm(pantryName(name || ""));
  if (!k) return DEFAUT;
  const hit = _memo.get(k);
  if (hit) return hit;
  let info = DEFAUT;
  // mots entiers, comme pour les prix : « bœuf » ne doit pas tomber dans « œuf » ;
  // puis au singulier (« tagliatelles », « avocats »)
  const sg = k
    .split(" ")
    .map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w))
    .join(" ");
  outer: for (const cand of [k, sg]) {
    for (const [re, emoji, aisle, shelf] of R) {
      const reBord = new RegExp("(^|\\s)(?:" + re.source + ")(?=$|\\s)");
      if (reBord.test(cand)) {
        info = { emoji, aisle, shelf };
        break outer;
      }
    }
  }
  _memo.set(k, info);
  return info;
}
export const emojiOf = (name: string) => productInfo(name).emoji;
export const aisleOf = (name: string) => productInfo(name).aisle;
export const aisleInfo = (id: AisleId) => AISLES.find((a) => a.id === id) || AISLES[AISLES.length - 1];

/** Ingrédients « vedettes » d'une recette pour l'illustration : les plus caractéristiques. */
export function featuredEmojis(ing: { n: string }[], max = 4): string[] {
  const out: string[] = [];
  const banal = /🧂|🫗|💧|🍬|🌾|🧁|🫙/;
  for (const i of ing) {
    const e = emojiOf(i.n);
    if (e === "🍽️" || banal.test(e) || out.includes(e)) continue;
    out.push(e);
    if (out.length >= max) break;
  }
  return out;
}
