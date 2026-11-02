/* Visuel d'une recette : la photo du plat (ou, à défaut, celle d'un plat qui lui
   ressemble, signalée « Photo indicative » sur la fiche). Sans photo — recettes
   perso, imports sans image — une illustration composée à partir de SES ingrédients. */
import { useEffect, useState } from "preact/hooks";
import { featuredEmojis } from "../../core/catalog";
import type { Recipe } from "../../core/recipe";
import { hashStr } from "../../core/text";
import { communityPhotos, localGet, localSet, recipePhotos } from "../../state/store";

const PALETTES: Record<string, [string, string][]> = {
  Plat: [
    ["#E7A43F", "#B85A26"],
    ["#D9823A", "#963F1E"],
    ["#C9A25A", "#7E5A26"],
    ["#E0B25B", "#B26A1F"]
  ],
  Entrée: [
    ["#9CC08A", "#3F7A52"],
    ["#B7CF7A", "#5B8A3A"],
    ["#8FC3AE", "#2F6E5D"]
  ],
  Dessert: [
    ["#E6A3A8", "#B4535F"],
    ["#C79474", "#77432C"],
    ["#F0BE88", "#C2733E"]
  ],
  Apéro: [
    ["#F2CB6A", "#C98A1E"],
    ["#A9C77F", "#4F8A52"]
  ],
  "Petit-déj": [
    ["#F5D684", "#D9952C"],
    ["#F1BC8F", "#C9733C"]
  ],
  Accompagnement: [
    ["#CDB07A", "#8A6430"],
    ["#B9C98A", "#6C8442"]
  ]
};

export function Illustration({ r }: { r: Recipe }) {
  const h = hashStr(r.id || r.nom);
  const pal = PALETTES[r.cat] || PALETTES.Plat;
  const [a, b] = pal[h % pal.length];
  const sides = featuredEmojis(r.ing, 4).filter((e) => e !== r.emoji);
  const angle = 120 + (h % 80);
  return (
    <div class="illu" style={{ background: `linear-gradient(${angle}deg, ${a}, ${b})` }} aria-hidden="true">
      {sides.slice(0, 4).map((e, i) => (
        <span class={"side s" + ((i + h) % 4)}>{e}</span>
      ))}
      <div class="plate">
        <span>{r.emoji || "🍽️"}</span>
      </div>
    </div>
  );
}

/* TheMealDB sert des miniatures (« /medium ») : on s'en sert si elles répondent,
   sinon on retombe sur l'image d'origine et on s'en souvient. */
let sizedOk: boolean | null = (() => {
  const v = localGet<string>("gabcook_mealdb_sized");
  return v === "1" ? true : v === "0" ? false : null;
})();
function sized(url: string, small: boolean): string {
  if (!small || sizedOk === false || !/themealdb\.com\/images\/media\/meals\/[^/]+\.(jpe?g|png)$/i.test(url)) return url;
  return url + "/medium";
}

export function photoSources(r: Recipe): string[] {
  const out: string[] = [];
  const mine = recipePhotos.value[r.id];
  if (mine) out.push(mine);
  if (r.photo) out.push(r.photo);
  const com = communityPhotos.value[r.id];
  if (com && com.length) out.push(com[0].url);
  return [...new Set(out)];
}

export function Cover({ r, small = true, class: cls = "", children }: { r: Recipe; small?: boolean; class?: string; children?: any }) {
  const sources = photoSources(r);
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [useSized, setUseSized] = useState(true);
  useEffect(() => {
    setI(0);
    setLoaded(false);
    setUseSized(true);
  }, [r.id, sources[0]]);
  const src = sources[i];
  const url = src ? (useSized ? sized(src, small) : src) : "";
  return (
    <div class={"cover " + cls}>
      <Illustration r={r} />
      {url && (
        <img
          class={"photo" + (loaded ? " loaded" : "")}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ position: "absolute", inset: 0 }}
          onLoad={() => {
            setLoaded(true);
            if (url !== src && sizedOk !== true) {
              sizedOk = true;
              localSet("gabcook_mealdb_sized", "1");
            }
          }}
          onError={() => {
            if (url !== src) {
              sizedOk = false;
              localSet("gabcook_mealdb_sized", "0");
              setUseSized(false);
              return;
            }
            setLoaded(false);
            if (i < sources.length - 1) setI(i + 1);
            else setI(sources.length); // plus rien : l'illustration reste
          }}
        />
      )}
      {children}
    </div>
  );
}
