# Yummly — cuisine avec ce que tu as

Application web (installable sur téléphone) : plus de 700 recettes avec photos, le frigo,
la liste de courses, le planning de la semaine, le mode cuisine pas à pas et un réseau
social pour partager ses plats. En ligne sur **https://yummly.fr**.

## Ajouter ou modifier une recette

Les recettes ne sont plus dans le code : elles sont dans `data/recettes/`, un fichier par
catégorie (`plats.txt`, `desserts.txt`…), dans un format lisible :

```
=== Pâtes à la carbonara
id: carbonara
emoji: 🍝
categorie: Plat
preparation: 10
cuisson: 15
portions: 4
difficulte: Facile
photo: https://www.themealdb.com/images/media/meals/xxxx.jpg
ingredients:
- spaghetti : 400 g
- œufs : 4
- sel
etapes:
1. Portez une grande casserole d'eau salée à ébullition.
2. …
```

- `id` : unique, en minuscules sans accents (il sert dans les liens partagés : ne pas le
  changer pour une recette existante).
- `categorie` : Plat, Entrée, Accompagnement, Dessert, Apéro ou Petit-déj.
- `difficulte` : Facile, Moyen ou Difficile.
- Quantités : `nom : 400 g`, `nom : 2` (pièces), ou rien (`- sel`). Unités : g, kg, ml, cl,
  l, c. à soupe, c. à café, pincée, poignée, sachet, pot, cm, tranches, feuilles.
- `photo` (facultatif) : l'adresse d'une photo du plat. Sans photo, l'appli dessine une
  illustration à partir des ingrédients.
- `photo_proche: oui` (facultatif) : la photo montre un plat qui ressemble, pas exactement
  celui-ci ; la fiche affiche alors « Photo indicative ». À retirer quand on trouve la
  vraie photo.
- `nouveau: oui` (facultatif) : la recette apparaît dans « Nouveautés » (à retirer de la
  vague précédente quand on en ajoute une nouvelle).
- Une durée écrite dans une étape (« laissez mijoter 20 min ») devient un minuteur dans le
  mode cuisine.

L'origine du plat (filtre « Cuisine » et planning) est devinée à partir du nom et des
ingrédients ; pour la fixer, ajoutez l'identifiant dans `CUISINE_FORCE` ou `ORIGINES`
(`src/core/tables.ts`).

### Avoir beaucoup plus de recettes

1. **Le catalogue** : chaque bloc ajouté dans `data/recettes/*.txt` devient une recette
   pour tout le monde au prochain déploiement. Les photos viennent de TheMealDB (licence
   CC BY-SA) ; l'adresse se trouve sur la fiche du plat sur themealdb.com.
2. **L'import par lien** : dans l'appli, « Importer depuis un lien » lit les recettes de
   Marmiton, 750g, CuisineAZ, Journal des Femmes, Ricardo, BBC Good Food… (tout site qui
   publie le format schema.org/Recipe). La page est lue par la fonction serveur Supabase
   `importer-recette` (`supabase/functions/importer-recette`), avec des relais publics en
   secours.
3. **La communauté** : les recettes créées par les membres connectés apparaissent dans
   « Recettes de la communauté » sur l'accueil (profils publics, et amis pour les profils
   privés) ; un geste les ajoute à « Mes recettes ».

Les versions **air fryer** et **micro-ondes** d'une recette sont dans `data/airfryer.json`
et `data/microondes.json` (étapes réécrites, repérées par leur numéro à partir de 0).

À chaque mise en ligne, le catalogue est vérifié (identifiants en double, champs
manquants, unité inconnue…) : une erreur de saisie bloque le déploiement au lieu de
casser le site.

## Développer

```bash
npm install
npm run dev      # appli locale sur http://localhost:5173
npm test         # tests de la logique (ingrédients, frigo, prix, planning…)
npm run build    # version de production dans dist/
```

Organisation du code (`src/`) :

| Dossier | Contenu |
| --- | --- |
| `core/` | Logique pure, testée : noms d'ingrédients, correspondance avec le frigo, unités, prix, saisons, remplacements, planning, liens de partage, import web, Open Food Facts |
| `state/` | État de l'application (signaux), sauvegarde locale et synchronisation du compte, actions de l'utilisateur |
| `services/` | Supabase (compte, social), scanner de codes-barres, import de recettes web, fonctions de l'appareil (minuteurs, voix, partage) |
| `ui/` | Écrans et composants (Preact) |
| `styles/` | Système visuel (thème clair/sombre) |

## Données des utilisateurs

Les données sont enregistrées sous les mêmes clés que la première version (`gabcook_*`) :
en local sur l'appareil, ou dans la table `gabcook_store` de Supabase une fois connecté.
Les tables sociales (`profiles`, `friendships`, `posts`, `reactions`, `comments`,
`recipes`, `ratings`) et le stockage photo `dishes` sont inchangés.

## Mise en ligne

Un push sur `main` lance `.github/workflows/deploy.yml` : vérification du catalogue,
tests, construction, puis publication sur GitHub Pages (domaine `yummly.fr`, fichier
`public/CNAME`).

La fonction serveur d'import se déploie à part :

```bash
supabase functions deploy importer-recette
```

## Crédits

Photos des plats : [TheMealDB](https://www.themealdb.com) et la communauté Yummly.
Données produits du scanner : [Open Food Facts](https://world.openfoodfacts.org).
