/* Tables de référence reprises telles quelles de la version 1 de Yummly :
   elles ont été corrigées au fil des audits (voir les commentaires), on ne les réécrit pas. */
/* eslint-disable */
export interface PantryRule { re: RegExp; n: string; n1?: string; part?: number }

export const STOP = new Set(["de","d","du","des","la","le","les","a","au","aux","en","c","soupe","cafe","cuillere","cuilleres","g","kg","cl","l","ml","pincee","sachet","poignee","gousse","gousses","tranche","tranches","morceau","boule","boules","cur","coeur","petit","petite","pot","pots","frais","fraiche","fraiches","fondu","rape","rapee","rapes","mur","murs","mure","mures","chinoises","fort","secs","liquide"]);

export const PANTRY: PantryRule[] = [
  {re:/^(?:jaunes?|blancs?) d[’']?(?:œuf|oeuf)s?$/i,  n:"œufs", n1:"œuf", part:1},
  {re:/^(?:œuf|oeuf)s?$/i,                            n:"œufs"},
  {re:/^beurre fondu$/i,                              n:"beurre"},
  {re:/^bouquet de (.+)$/i,                           n:"$1"},
  {re:/^feuilles? de laurier$/i,                      n:"laurier"},
  {re:/^tranches? de fromage à raclette$/i,           n:"fromage à raclette"},
  /* produits à part entière, à ne pas confondre avec le produit dont ils portent le nom */
  {re:/^pommes? de terre$/i,                          n:"pommes de terre"},
  {re:/^pâte (brisée|sablée|feuilletée|à pizza|à tarte|de curry)$/i, n:"pâte $1"},
  {re:/^lait de coco$/i,                              n:"lait de coco"},
  {re:/^huile d[’']olive$/i,                          n:"huile d'olive"},
  {re:/^tomates? cerises?$/i,                         n:"tomates cerises"},
  {re:/^concentré de tomate$/i,                       n:"concentré de tomate"},
  {re:/^sauce tomate$/i,                              n:"sauce tomate"},
  {re:/^nouilles de riz$/i,                           n:"nouilles de riz"},
  /* le citron vert est un autre fruit : sans cette ligne, la règle générale
     (« citron » est inclus dans « citron vert ») ferait passer l'un pour l'autre */
  {re:/^citrons? verts?$/i,                           n:"citron vert"},
  {re:/^chocolat blanc$/i,                            n:"chocolat blanc"}
];

export const UNITES_TXT = "kg|g|mg|l|cl|ml|dl";

export const GARDER_TEL_QUEL: RegExp[] = [
  /^pommes? de terre$/i, /^patates? douces?$/i, /^lait de coco$/i, /^lait concentré$/i,
  /^huile d[’']olive$/i, /^huile de sésame$/i, /^vinaigre balsamique$/i,
  /^haricots? (verts?|rouges?|blancs?|noirs?)$/i, /^chou (rouge|vert|blanc|chinois)$/i,
  /^chou-fleur$/i, /^choux? de bruxelles$/i, /^vin (blanc|rouge)$/i,
  /^chocolat (noir|blanc|au lait)$/i, /^sucre (glace|vanillé|roux|complet)$/i,
  /^fromage (blanc|râpé|de chèvre|à raclette)$/i, /^crème (de coco|de marron)$/i,
  /^pâte (brisée|sablée|feuilletée|à pizza|à tarte|de curry|d[’']amande)$/i,
  /^tomates? (cerises?|séchées?|concassées?|pelées?)$/i, /^concentré de tomates?$/i,
  /^sauce (tomate|soja|worcestershire)$/i, /^nouilles de riz$/i, /^vermicelles? de riz$/i,
  /^galettes? de riz$/i, /^lait (de soja|d[’']amande|ribot)$/i, /^poudre d[’']amandes?$/i,
  /^levure (chimique|boulangère|de bière)$/i, /^ail en poudre$/i, /^oignons? (nouveaux?|nouvelles?|frits?)$/i,
  /^gâteaux? de riz$/i, /^beurre de cacahuète$/i,
  /^gousses? de vanille$/i, /^petits pois$/i,
  /^pousses? de soja$/i, /^lait de brebis$/i,
  /* faux amis repérés à l'audit : ce sont des produits en soi, pas des variantes */
  /^fromage frais$/i, /^cr[èe]me fra[îi]che [ée]paisse$/i, /^saumon fum[ée]$/i,
  /^poitrine fum[ée]e$/i, /^jambon cru$/i, /^poisson blanc$/i, /^pain de mie$/i,
  /^noix de (muscade|coco|p[ée]can)$/i, /^graines? de (s[ée]same|courge|pavot|lin)$/i,
  /^dos de cabillaud$/i, /^lait de coco$/i, /^eau de fleur d[’']oranger$/i,
  /^vinaigre (balsamique|de riz)$/i, /^huile de (s[ée]same|noix)$/i, /^sucre vanill[ée]$/i
];

export const PORTIONS = new RegExp(
  "^\\s*(?:\\d+[\\d.,/ ]*)?\\s*(?:une?|deux|trois|quelques|petite?s?|grosse?s?)?\\s*" +
  "(?:gousses?|bottes?|brins?|branches?|tranches?|filets?|escalopes?|blancs?|cuisses?|" +
  "pav[ée]s?|aiguillettes?|morceaux?|c[ôo]tes?|boîtes?|boites?|bocaux?|bocal|sachets?|" +
  "pots?|barquettes?|cubes?|feuilles?|pinc[ée]es?|poign[ée]es?|t[êe]tes?|grappes?|" +
  "parts?|portions?|tablettes?|b[âa]tons?|tiges?|rondelles?|lamelles?|d[ée]s|" +
  "tron[çc]ons?|c[œo]eurs?|gigots?|[ée]paules?|r[ôo]tis?|steaks?|darnes?)\\s+" +
  "d[’']?(?:e\\s+|es\\s+|u\\s+)?", "i");

export const TAILLE = /^(?:petits?|petites?|gros|grosses?|grands?|grandes?|mini)\s+/i;

export const QUALIF_ING = new RegExp(
  "(^|[\\s,])(?:frais|fra[îi]che?s?|surgel[ée]e?s?|congel[ée]e?s?|bio|nature|entiers?|enti[èe]re?s?|" +
  "[ée]goutt[ée]e?s?|pel[ée]e?s?|[ée]pluch[ée]e?s?|[ée]minc[ée]e?s?|cisel[ée]e?s?|" +
  "concass[ée]e?s?|r[âa]p[ée]e?s?|moulue?s?|doux|douce|all[ée]g[ée]e?s?|extra|vierge|" +
  "de qualit[ée]|du commerce|maison|m[ûu]re?s?|de saison|coup[ée]e?s?|lav[ée]e?s?|" +
  "d[ée]nud[ée]e?s?|d[ée]noyaut[ée]e?s?|effiloch[ée]e?s?|tranch[ée]e?s?|en morceaux|en d[ée]s|" +
  "en rondelles|en lamelles|en poudre|liquide|semi-[ée]cr[ée]m[ée]|demi-[ée]cr[ée]m[ée]|" +
  "d[ée]cortiqu[ée]e?s?|d[ée]sar[êe]t[ée]e?s?|vid[ée]e?s?|fine?s?|[ée]pais(?:se)?s?|" +
  "demi-sel|du moulin|complets?|compl[èe]tes?|en grains|en branche|en conserve|en boîte|" +
  "sans (?:peau|os|sucre|gluten|lactose)|bien m[ûu]re?s?|de printemps)" +
  "(?=[\\s,]|$)", "gi");

export const COULEUR_OK = /\b(oignons?|poivrons?|tomates?|raisins?|courgettes?|aubergines?|carottes?)\s+(rouges?|jaunes?|verts?|blancs?|violettes?|orange)\b/i;

export const SYNONYMES: [RegExp, string][] = [
  [/^patates?$/i, "pommes de terre"],
  [/^cr[èe]me (liquide|enti[èe]re|[ée]paisse|fleurette|fra[îi]che( [ée]paisse| liquide)?)$/i, "crème"],
  [/^persil (plat|fris[ée])$/i, "persil"],
  [/^(gros )?sel( fin| de mer| de guérande)?$/i, "sel"],
  [/^poivre( noir| du moulin| en grains)$/i, "poivre"],
  [/^farines? (de bl[ée]|t\d+)$/i, "farine"],
  [/^sucres? (en poudre|semoule|blanc|cristallis[ée])$/i, "sucre"],
  [/^(steaks? )?hach[ée]s?$/i, "viande hachée"],
  [/^bl[ée] concass[ée]$/i, "boulgour"],
  [/^oeufs?$/i, "œufs"],
  /* variétés : une recette qui demande « riz » se fait très bien avec du basmati */
  [/^riz (basmati|complet|long|rond|thaï|thai|arborio|parfum[ée]|blanc|jasmin)$/i, "riz"],
  [/^p[âa]tes? (compl[èe]tes?|fra[îi]ches?|s[èe]ches?)$/i, "pâtes"],
  [/^farines? (compl[èe]te|t\d+|de froment)$/i, "farine"],
  [/^huiles? (de )?(colza|tournesol|friture|arachide|p[ée]pins de raisin|v[ée]g[ée]tale|neutre)$/i, "huile"],
  [/^vinaigres? (de )?(vin|cidre|blanc|d[’']alcool|de xer[èe]s)$/i, "vinaigre"],
  [/^moutardes? (de )?(dijon|forte|douce|[àa] l[’']ancienne)$/i, "moutarde"],
  [/^jambons? (blanc|de paris|d[ée]coupé)$/i, "jambon"],
  [/^lardons? (fum[ée]s?|nature|allum[ée]ttes?)$/i, "lardons"],
  [/^(bouillons? cubes?|cubes? de bouillon)$/i, "bouillon"],
  [/^pommes? (golden|granny|gala|pink lady|reinette|royal gala)$/i, "pommes"],
  [/^(pommes? de terre|patates?) (nouvelles?|à chair ferme|grenailles?|charlotte|bintje)$/i, "pommes de terre"],
  [/^salades? (verte|iceberg|romaine|batavia|frisée)$/i, "salade"],
  [/^laits? (de vache|entier|[ée]cr[ée]m[ée])$/i, "lait"],
  [/^yaourts? (grec|brass[ée]|de brebis|au lait entier)$/i, "yaourt"]
];

export const FAMILLES: { gen: RegExp; membres: RegExp }[] = [
  {gen:/^(pates|pate)$/,
   membres:/^(spaghetti|tagliatelle|penne|fusilli|macaroni|linguine|farfalle|coquillette|rigatoni|orecchiette|conchiglie|tortellini|raviolis?|lasagne|gnocchi|vermicelle|nouille|capellini|bucatini|trofie|papardelle|cannelloni)/},
  {gen:/^riz$/,          membres:/^(basmati|arborio|jasmin)/},
  {gen:/^(fromage|fromagerape)$/,
   membres:/^(gruyere|emmental|comte|cantal|mimolette|raclette)/},
  {gen:/^(poisson|poissonblanc)$/,
   membres:/^(cabillaud|colin|merlu|lieu|julienne|eglefin|merlan|dorade)/},
  {gen:/^(viandehachee|viande)$/,
   membres:/^(steakh?ach|boeufhach|porchach|veauhach|agneauhach|dindehach|volaillehach)/},
  {gen:/^salade$/,       membres:/^(laitue|batavia|romaine|frisee|roquette|mache|iceberg)/},
  {gen:/^huile$/,        membres:/^(huiledetournesol|huiledecolza|huilevegetale)/},
  {gen:/^farine$/,       membres:/^(farinedeble|farinet\d+)/},
  {gen:/^sucre$/,        membres:/^(sucreblanc|sucresemoule|sucreenpoudre)/},
  {gen:/^bouillon$/,     membres:/^(bouillondevolaille|bouillondelegumes|bouillondeboeuf|bouilloncube)/},
  {gen:/^(herbesdeprovence|herbes)$/, membres:/^(thym|romarin|origan|sarriette)/}
];

export const SMALL: Record<string, { g: number; ml: number }> = { "pincée":{g:0.5,ml:0.5}, "c. à café":{g:5,ml:5}, "c. à soupe":{g:15,ml:15}, "poignée":{g:30,ml:30} };

export const EQUIPEMENTS: { id: string; nom: string; emoji: string }[] = [
  {id:"four",     nom:"Four",         emoji:"🔥"},
  {id:"plaques",  nom:"Plaques / gaz",emoji:"🍳"},
  {id:"micro",    nom:"Micro-ondes",  emoji:"🔆"},
  {id:"airfryer", nom:"Air fryer",    emoji:"🍟"},
  {id:"mixeur",   nom:"Mixeur / blender", emoji:"🌀"},
  {id:"cocotte",  nom:"Cocotte / faitout", emoji:"🍲"}
];

export const ALLERGENES: { id: string; nom: string; re: RegExp }[] = [
  {id:"gluten",   nom:"Gluten",        re:/\b(farine|pates?|spaghetti|tagliatelle|penne|macaroni|coquillettes|nouilles|semoule|couscous|boulgour|chapelure|pain|baguette|biscuits?|pate (brisee|feuilletee|sablee|a pizza|a tarte)|lasagnes?|cannellonis?|tortellinis?|gnocchis?|tortillas|pita|wraps?|biere)\b/},
  {id:"lactose",  nom:"Lait / lactose",re:/\b(lait|beurre|creme|fromage|gruyere|emmental|comte|parmesan|mozzarella|chevre|roquefort|ricotta|mascarpone|yaourt|creme fraiche|glace)\b/},
  {id:"oeuf",     nom:"Œufs",          re:/\b(oeufs?|œufs?|mayonnaise|meringue)\b/},
  {id:"arachide", nom:"Arachides",     re:/\b(cacahuetes?|arachide|beurre de cacahuete)\b/},
  {id:"noix",     nom:"Fruits à coque",re:/\b(amandes?|noix|noisettes?|pistaches?|noix de cajou|pignons)\b/},
  {id:"poisson",  nom:"Poisson",       re:/\b(poissons?|saumon|thon|cabillaud|colin|truite|merlu|sardines?|anchois|lieu|dorade|daurade|bar|espadon|surimi|haddock)\b/},
  {id:"crustace", nom:"Crustacés",     re:/\b(crevettes?|gambas|langoustines?|langouste|homard|crabe|ecrevisse|moules?|huitres?|palourdes?|fruits de mer|calamars?|seiche|poulpe)\b/},
  {id:"soja",     nom:"Soja",          re:/\b(soja|tofu|sauce soja)\b/},
  {id:"moutarde", nom:"Moutarde",      re:/\bmoutarde\b/}
];

export const AVERSIONS: { id: string; nom: string; re: RegExp }[] = [
  {id:"poisson",   nom:"Poisson",        re:/\b(poissons?|saumon|thon|cabillaud|colin|truite|merlu|sardines?|anchois|lieu|dorade|daurade|bar|espadon|surimi|haddock|brandade)\b/},
  {id:"fruitsmer", nom:"Fruits de mer",  re:/\b(crevettes?|gambas|moules?|huitres?|calamars?|seiche|poulpe|crabe|homard|langoustines?|fruits de mer)\b/},
  {id:"porc",      nom:"Porc",           re:/\b(porc|lardons?|jambon|saucisses?|saucisson|chorizo|bacon|travers|echine|andouille|boudin|poitrine)\b/},
  {id:"boeuf",     nom:"Viande rouge",   re:/\b(boeuf|steaks?|rumsteck|entrecote|onglet|bavette|veau|agneau|mouton)\b/},
  {id:"abats",     nom:"Abats",          re:/\b(foie|rognons?|gesiers?|tripes|langue|cervelle)\b/},
  {id:"champignon",nom:"Champignons",    re:/\bchampignons?\b/},
  {id:"olive",     nom:"Olives",         re:/\bolives?|tapenade\b/},
  {id:"epice",     nom:"Plats épicés",   re:/\b(piment|harissa|sriracha|curry fort|pimentee?)\b/},
  {id:"fromage",   nom:"Fromage fort",   re:/\b(roquefort|bleu|maroilles|munster|reblochon|chevre)\b/},
  {id:"oignon",    nom:"Oignon / ail",   re:/\b(oignons?|echalotes?|ail)\b/}
];

export const PRIX: [RegExp, number, "kg" | "l" | "pc"][] = [ // [motif, prix, unité de référence]  kg = €/kg, l = €/L, pc = €/pièce
  [/sel|poivre|muscade|cannelle|vanille|piment|curcuma|paprika|cumin|curry|colombo|safran|origan|thym|laurier|herbes|basilic|persil|coriandre|ciboulette|estragon|romarin|bouquet garni|levure|bicarbonate/,25,"kg"],
  [/huile d.olive/,8,"l"],[/huile de sesame/,12,"l"],[/huile/,2.5,"l"],
  [/beurre/,10,"kg"],[/creme fraiche|creme liquide|creme/,3.5,"l"],[/lait de coco/,3.5,"l"],[/lait/,1.1,"l"],
  [/oeufs?|œufs?/,0.35,"pc"],[/farine/,1.2,"kg"],[/sucre|cassonade/,1.3,"kg"],[/miel/,12,"kg"],
  [/parmesan/,20,"kg"],[/gruyere|emmental|comte|fromage rape/,12,"kg"],[/mozzarella/,9,"kg"],
  [/fromage de chevre|chevre/,14,"kg"],[/roquefort|bleu/,16,"kg"],[/ricotta|mascarpone/,8,"kg"],[/fromage blanc|yaourt/,0.45,"pc"],
  [/riz basmati|riz arborio|riz/,2.2,"kg"],[/pates|spaghetti|tagliatelle|penne|macaroni|coquillettes|nouilles|tortellinis?|cannellonis?|lasagnes?/,1.8,"kg"],
  [/semoule|couscous|boulgour/,2.2,"kg"],[/quinoa/,6,"kg"],[/polenta/,2.5,"kg"],[/gnocchis/,3,"kg"],
  [/flocons d.avoine|avoine/,2.5,"kg"],[/chapelure/,3,"kg"],[/pain de mie|baguette|pain/,2.5,"kg"],
  [/pate brisee|pate feuilletee|pate sablee|pate a pizza|pate a tarte/,1.6,"pc"],[/tortillas|pains? pita|galettes/,0.35,"pc"],
  [/blancs? de poulet|escalopes? de (poulet|dinde)/,12,"kg"],[/cuisses? de poulet|poulet fermier|poulet/,6.5,"kg"],
  [/dinde/,10,"kg"],[/boeuf hache|steaks? haches?/,12,"kg"],[/boeuf a braiser|boeuf a griller|rumsteck|onglet|entrecote|steaks?|roti de boeuf|boeuf/,15,"kg"],
  [/veau/,18,"kg"],[/agneau/,16,"kg"],[/lardons|bacon|poitrine/,10,"kg"],[/jambon/,12,"kg"],
  [/chorizo|saucisson/,14,"kg"],[/saucisses|merguez|chair a saucisse/,9,"kg"],[/travers de porc|echine|filet mignon|sautee? de porc|roti de porc|porc/,9,"kg"],
  [/saumon|truite/,20,"kg"],[/cabillaud|colin|poisson blanc|filets? de poisson|dos de/,16,"kg"],[/thon/,12,"kg"],
  [/crevettes|gambas/,20,"kg"],[/moules/,4,"kg"],[/fruits de mer/,14,"kg"],[/anchois/,25,"kg"],
  [/tomates concassees|sauce tomate|coulis/,1.8,"kg"],[/concentre de tomate/,5,"kg"],[/tomates cerises/,6,"kg"],[/tomates?/,3,"kg"],
  [/pommes de terre|patates douces|patate douce|grenailles/,1.6,"kg"],[/oignons?|echalotes?/,1.6,"kg"],[/gousses? d.ail|ail/,8,"kg"],
  [/carottes?/,1.3,"kg"],[/courgettes?/,2.5,"kg"],[/aubergines?/,3,"kg"],[/poivrons?/,4,"kg"],
  [/champignons/,5,"kg"],[/brocoli|chou-fleur|chou/,2.8,"kg"],[/epinards/,4,"kg"],[/poireaux?/,2.5,"kg"],
  [/salade verte|salade|laitue|roquette/,1.5,"pc"],[/concombre/,1,"pc"],[/citrons? verts?|citrons?/,0.55,"pc"],
  [/avocat/,1.5,"pc"],[/bananes?/,1.8,"kg"],[/pommes?|poires?/,2.5,"kg"],[/fraises|myrtilles|fruits rouges|cerises/,10,"kg"],
  [/courge butternut|potiron|courge/,2,"kg"],[/petits pois|haricots verts/,3,"kg"],
  [/haricots (rouges|blancs)|pois chiches|lentilles|mais/,2.2,"kg"],[/olives/,9,"kg"],[/cornichons|capres/,8,"kg"],
  [/tofu/,9,"kg"],[/amandes|noix|cacahuetes|pate d.arachide|sesame/,12,"kg"],
  [/chocolat/,10,"kg"],[/cacao/,12,"kg"],[/creme de marron|confiture/,6,"kg"],
  [/sauce soja/,5,"l"],[/vinaigre/,2,"l"],[/moutarde/,5,"kg"],[/mayonnaise|ketchup/,5,"kg"],
  [/vin (blanc|rouge)|biere|cognac/,4,"l"],[/bouillon/,0.4,"l"],[/eau/,0,"l"],
  [/gingembre/,8,"kg"],[/pate de curry/,15,"kg"],[/sirop d.erable/,15,"l"],[/glace|creme glacee/,5,"kg"]
];

export const POIDS_PIECE: [RegExp, number][] = [[/gousses? d.ail/,0.005],[/echalotes?/,0.03],[/oignons?/,0.15],[/tomates?/,0.12],[/carottes?/,0.1],
[/courgettes?/,0.25],[/aubergines?/,0.3],[/poivrons?/,0.15],[/pommes de terre|patates?/,0.15],[/pommes?|poires?/,0.15],
[/citrons?/,0.1],[/bananes?/,0.12],[/poireaux?/,0.2],[/brocoli|chou-fleur|chou/,0.5],[/courge butternut|courge|potiron/,1.2],
[/cuisses? de poulet|escalopes? de poulet|blancs? de poulet/,0.2],[/poulet fermier|poulet entier|poulet/,1.4],
[/escalopes?|paves?|filets?|dos de|steaks?/,0.15],[/tranches?/,0.03],[/saucisses|merguez/,0.08],
[/gambas|crevettes/,0.025],[/champignons/,0.02],[/olives/,0.005],[/abricots|prunes|figues/,0.05]];

export const ENSEIGNES: [string, number][] = [["Lidl",0.86],["Aldi",0.87],["E.Leclerc",0.91],["Intermarché",0.96],["Auchan",0.98],["Carrefour",1.00],["Super U",1.03],["Monoprix",1.24]];

export const CUISINES: { id: string; nom: string; emoji: string; re: RegExp }[] = [
  {id:"latam", nom:"Amérique latine & Caraïbes", emoji:"🌎",
   re:/arepas?|feijoada|ropa vieja|asado|chimichurri|choripan|picadillo|gallo pinto|chivito|alfajores|quindim|bresilien|cubain|jamaicain|jamaique|venezuel|empanadas|moqueca|brigadeiros?|pao de queijo|jerk|bunuelos/},
  {id:"nord", nom:"Europe du Nord & de l'Est", emoji:"🌲",
   re:/polonais|norvegien|russe|bortsch|pierogi|blinis?|harengs?|goulash|bigos|stroganoff|suedois|hollandais|stamppot|poffertjes|kapsalon|halusky|zapiekanka|piernik|paczki|rogaliki|oukha/},
  {id:"ital", nom:"Italienne", emoji:"🇮🇹",
   re:/pizza|pasta|pates|spaghetti|tagliatelle|penne|macaroni|lasagne|cannelloni|tortellini|gnocchi|risotto|carbonara|bolognaise|amatriciana|puttanesca|cacio|norma|parmigiana|tiramisu|panna cotta|bruschetta|minestrone|pesto|mozzarella|focaccia|osso|saltimbocca|caprese|arancini|panzanella|alfredo|calzone|milanaise|fagioli|vitello|scaloppine|ribollita|orecchiette|piadina|crostini|polpette|burrata|brodo/},
  {id:"asie", nom:"Asiatique", emoji:"🥢",
   re:/wok|nouilles|riz cantonais|riz saute|pad thai|bo bun|teriyaki|yakisoba|ramen|chow mein|nasi goreng|oyakodon|loc lac|kung pao|general tao|aigre-doux|sauce soja|gingembre|tofu|curry japonais|samoussa|nem|biryani|tikka|massala|dahl|butter chicken|tandoori|colombo|curry|coco|bibimbap|gyoza|mapo|dan dan|katsudon|tom kha|singapour|coreen|kimchi|massaman|okonomiyaki|bulgogi|tteokbokki|laksa|nasi lemak|japchae|karaage|satay|congee|rouleaux de printemps/},
  {id:"mex",  nom:"Mexicaine", emoji:"🌮",
   re:/tacos|burrito|quesadilla|fajitas|enchiladas|chili|guacamole|nachos|tortillas|wrap|chilaquiles|tostada|carnitas|elote|mexicaine|huevos rancheros|sopa|pozole|ceviche|sauce mole|frijoles|aguachile|tamales|birria|flautas|salsa verde|dorados/},
  {id:"med",  nom:"Méditerranéenne", emoji:"🫒",
   re:/grecque|souvlaki|gyros|tzatziki|houmous|falafel|taboule|moussaka|feta|olives|tapenade|ratatouille|tian|shakshuka|paella|tortilla espagnole|gaspacho|caviar d.aubergine|pissaladiere|spanakopita|briam|bravas|albondigas|pastitsio|dolma|feuilles de vigne|gazpacho|horiatiki|keftedes|caponata|portugaise|manchego|gigantes|tiropita/},
  {id:"orient",nom:"Orient & Afrique", emoji:"🍢",
   re:/tajine|couscous|kefta|merguez|mafe|yassa|semoule|shawarma|kebab|harissa|boulgour|harira|zaalouk|loubia|fattoush|moutabal|marocaine|libanaise|maakouda|msemen|chorba|batata harra|moujadara|kebbe|manakich/},
  {id:"us",   nom:"Américaine & anglaise", emoji:"🍔",
   re:/burger|ribs|travers de porc laques|cheesecake|brownie|pancakes|cookies|mac and cheese|nuggets|muffins|granola|banana bread|smoothie|coleslaw|cesar|fish and chips|pulled pork|jambalaya|sloppy|cornbread|philly|buffalo|chaudree|americain|gumbo|pain de viande|poulet frit|bagel|cobb|bbq/},
  {id:"fr",   nom:"Française", emoji:"🇫🇷", re:/.*/}      // par défaut
];

export const CUISINE_FORCE: Record<string, string> = {pastitsio:"med", harira:"orient", zaalouk:"orient", moutabal:"orient",
  loubia:"orient", tajinekefta:"orient", fattoush:"orient", dolmas:"med", briam:"med",
  spanakopita:"med", clamchowder:"us", jambalaya:"us", cornbread:"us", tajineolives:"orient", ceviche:"mex", satay:"asie", ribsbbq:"us", bacalhau:"med", gigantes:"med", tiropita:"med", friedrice:"asie"};

/* Recettes ajoutées en novembre 2026 : origine fixée à la main (les mots du nom ne suffisent pas). */
const ORIGINES: Record<string, string> = {
  latam: "arepapabellon asado feijoada chivito picadillo ropavieja choripan cotesporccreole pouletcocovenez curryagneaujamaique crevettescurryjamaique crevettespimentees escovitch gallopinto arepas alfajores bolocenoura quindim confiturelait cheesecakedulce chaussonschocolat beignetsbanane pattiesjamaicains papasrellenas bunuelos bananesroties maiscoco",
  nord: "bigos halusky zapiekanka goulashchoucroute chourougesaucisses farikal fiskesuppe oukha harengs piernik paczki rogaliki gateaunoixchocolat blinis saladeconcombrefenouil soupechampignonssarrasin boterkoek appeltaart oliebollen slagroomtaart kapsalon challah",
  us: "batonnetsfromage ragoutboulettes ragoutboeufpotiron tourtiere patechinois poutine queuescastor poudingchomeur tartesucre buttertarts nanaimo jamjam carresdattes tartemyrtilles colcannon boxty hotpotpoulet tourteagneau minitourtes burgerpoulet macpoulet cheesecakecacahuete cheesecakecaramel rockyroad donuts eccles mincepies rockcakes rolypoly summerpudding chelseabuns barrescroustillantes anzac carreschococo tartefraiserhubarbe painsoda gateauvegan biscuitscannelle",
  med: "rizgambas arrozhorno haricotspoulet empanadagallega pouletespagnole migas saladecalamars torrijas ensaimadas boucheesfigues crevettesciboule fofos tavekosi presh shakshukafeta poivronsfeta tartinesaubergine haricotschorizo rizfruitsmer",
  orient: "gigotarmenien epauleagneaucannelle pouletnoix auberginespoischiches cotelettesagneau corba fatteh kabsa kafteji chtithabatata flafla ghribia maamouls knafeh mantu kaduborani bolani fasoliyyeh painsplats gateaudattes currykenyan",
  asie: "bistek boeufcitronnelle saladenouillesboeuf baoporc saladeporcviet ayampercik pilonsthai soupeverte sourisagneauviet crevetteskungpao saladenouillescrevettes wrapssaumon crevettespoisgourmands makis soupenouillescurry banhmidinde auberginesadobo saladevermicellesthai mijotevietnamien soupeaigrepiquante tofusoyeux chouchinoiscrevettes raviolisriz rouleauxpoulet tortangtalong aubergineschips apambalik rotijohn calamarsselpoivre firni",
  fr: "confitcanard grenouilles bouletsliegeois stoemp hochepot saladeliegeoise chouboeuf tartelettespommes tarteriz patefoies briebrioche socca petitspains oignonsmarines glacecafe glacerhumraisin gateaupistache"
};
for (const [c, ids] of Object.entries(ORIGINES)) for (const id of ids.split(" ")) CUISINE_FORCE[id] = c;

export const NON_VEGE = ["poulet","poulets","volaille","boeuf","porc","veau","agneau","mouton","dinde","canard","lapin","pintade","caille","oie",
"lardon","lardons","jambon","bacon","saucisse","saucisses","saucisson","merguez","chorizo","andouille","boudin","charcuterie",
"pancetta","coppa","speck","poitrine","echine","rillettes","terrine","foie","gesier","magret","confit","viande","chair",
"steak","steaks","rumsteck","entrecote","faux filet","bavette","onglet","gigot","paleron","jarret","travers","cotelette","cotelettes",
"escalope","escalopes","cuisse","cuisses","aile","ailes","filet mignon","roti","kefta","keftas","kebab","gyros","merlan",
"poisson","poissons","saumon","thon","cabillaud","colin","truite","merlu","lieu","haddock","eglefin","sole","limande","turbot",
"sardine","sardines","maquereau","hareng","anchois","anchoi","lotte","daurade","dorade","bar","raie","espadon","surimi",
"crevette","crevettes","gambas","langoustine","langouste","homard","crabe","ecrevisse","moule","moules","huitre","huitres",
"palourde","coquillage","coquillages","saint jacques","calamar","calamars","encornet","seiche","poulpe","fruits de mer","lard","saindoux"];

export const COMMON: { n: string; q: number; u: string }[] = [
  {n:"Œufs",q:6,u:""},{n:"Lait",q:1,u:"l"},{n:"Beurre",q:250,u:"g"},{n:"Farine",q:1,u:"kg"},
  {n:"Sucre",q:1,u:"kg"},{n:"Huile d'olive",q:50,u:"cl"},{n:"Ail",q:1,u:""},{n:"Oignons",q:3,u:""},
  {n:"Tomates",q:4,u:""},{n:"Pommes de terre",q:1,u:"kg"},{n:"Riz",q:500,u:"g"},{n:"Pâtes",q:500,u:"g"},
  {n:"Parmesan",q:100,u:"g"},{n:"Lardons",q:200,u:"g"},{n:"Poulet",q:500,u:"g"},{n:"Carottes",q:4,u:""},
  {n:"Crème fraîche",q:20,u:"cl"},{n:"Sel",q:500,u:"g"},{n:"Poivre",q:100,u:"g"},{n:"Citron",q:2,u:""}
];

export const FR_EN: Record<string, string> = {boeuf:"beef",bœuf:"beef",poulet:"chicken",porc:"pork",veau:"veal",agneau:"lamb",dinde:"turkey",canard:"duck",
poisson:"fish",saumon:"salmon",thon:"tuna",cabillaud:"cod",colin:"hake",truite:"trout",crevettes:"shrimp",crevette:"shrimp",
gambas:"prawn",moules:"mussels",lardons:"bacon",jambon:"ham",saucisses:"sausage",saucisse:"sausage",merguez:"sausage",
pates:"pasta",spaghetti:"spaghetti",nouilles:"noodles",riz:"rice",semoule:"couscous",boulgour:"bulgur",quinoa:"quinoa",
polenta:"polenta",gnocchis:"gnocchi",lasagnes:"lasagne",tarte:"tart",quiche:"quiche",gateau:"cake",crepes:"crepe",
soupe:"soup",veloute:"soup",salade:"salad",oeufs:"eggs",oeuf:"egg",omelette:"omelette",fromage:"cheese",
pommes:"apple",pomme:"apple",banane:"banana",citron:"lemon",chocolat:"chocolate",fraise:"strawberry",
aubergines:"eggplant",aubergine:"eggplant",courgettes:"zucchini",courgette:"zucchini",tomates:"tomato",tomate:"tomato",
oignons:"onion",oignon:"onion",carottes:"carrot",carotte:"carrot",champignons:"mushroom",champignon:"mushroom",
poireaux:"leek",poivrons:"pepper",poivron:"pepper",brocoli:"broccoli",chou:"cabbage",epinards:"spinach",
lentilles:"lentil",haricots:"beans",pois:"peas",patates:"potato",patate:"potato",frites:"fries",puree:"mashed potatoes",
gratin:"gratin",curry:"curry",tajine:"tagine",couscous:"couscous",burger:"burger",pizza:"pizza",tacos:"taco",
farcies:"stuffed",farcis:"stuffed",roti:"roast",rotie:"roast",grille:"grilled",vapeur:"steamed",sautee:"stir fry",saute:"stir fry"};

export const OFF_CAT: [RegExp, string][] = [
  [/olive-oils|huiles-d-olive/,          "huile d'olive"],
  [/coconut-milks|laits-de-coco/,        "lait de coco"],
  [/creams|cremes-fraiches|cremes-liquides|single-creams/, "crème"],
  [/butters|beurres/,                    "beurre"],
  [/yogurts|yaourts|fermented-milk/,     "yaourt"],
  [/grated-cheeses|fromages-rapes/,      "fromage râpé"],
  [/cheeses|fromages/,                   "fromage"],
  [/milks|laits/,                        "lait"],
  [/eggs|oeufs/,                         "œufs"],
  [/pastas|pates-alimentaires|spaghetti|macaroni/, "pâtes"],
  [/rices|riz/,                          "riz"],
  [/flours|farines/,                     "farine"],
  [/sugars|sucres/,                      "sucre"],
  [/tomato-purees|concentres-de-tomates/,"concentré de tomate"],
  [/tomato-sauces|sauces-tomates/,       "sauce tomate"],
  [/canned-tomatoes|tomates-pelees/,     "tomates concassées"],
  [/tomatoes|tomates/,                   "tomates"],
  [/olives/,                             "olives"],
  [/vegetable-oils|huiles-vegetales|sunflower-oils/, "huile"],
  [/vinegars|vinaigres/,                 "vinaigre"],
  [/mustards|moutardes/,                 "moutarde"],
  [/soy-sauces|sauces-soja/,             "sauce soja"],
  [/chocolates|chocolats/,               "chocolat noir"],
  [/breads|pains/,                       "pain"],
  [/lardons|bacons/,                     "lardons"],
  [/hams|jambons/,                       "jambon"],
  [/chickens|poulets|volailles/,         "poulet"],
  [/minced-meat|viandes-hachees/,        "viande hachée"],
  [/salmons|saumons/,                    "saumon"],
  [/tunas|thons/,                        "thon"],
  [/lentils|lentilles/,                  "lentilles"],
  [/chick-peas|pois-chiches/,            "pois chiches"],
  [/kidney-beans|haricots-rouges/,       "haricots rouges"],
  [/canned-corn|sweet-corn/,             "maïs"],
  [/peas|petits-pois/,                   "petits pois"]
];
