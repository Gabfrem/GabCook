import { useMemo, useState } from "preact/hooks";
import { daysUntil, urgentItems } from "../../core/fridge";
import { libelleJour, joursAgenda, prochainRepas, cleJour } from "../../core/planner";
import { CATEGORIES, type Recipe } from "../../core/recipe";
import { nomMois } from "../../core/seasons";
import { cap, count } from "../../core/text";
import { displayName } from "../../state/actions";
import { agenda, allRecipes, catalogReady, fridge, profile, shopping, user, cookMode } from "../../state/store";
import { openOverlay, openSheet, setTab } from "../../state/ui";
import { Cover } from "../components/Cover";
import { Avatar, FavButton, Section, Shelf, Stars, openRecipe } from "../components/common";
import { Icon } from "../components/Icon";
import { antiGaspi, baseList, cookable, favList, fresh, minutes, plannedList, quick, recommended, seasonal, tonightIdeas } from "./lists";

const CAT_LABEL: Record<string, string> = {
  Plat: "Plats",
  Entrée: "Entrées",
  Accompagnement: "Accompagnements",
  Dessert: "Desserts",
  Apéro: "Apéro",
  "Petit-déj": "Petit-déj"
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function Hero() {
  const [seed, setSeed] = useState(0);
  const ideas = tonightIdeas(seed);
  if (!ideas.length) return null;
  const { r, ready, missing } = ideas[0];
  const h = new Date().getHours();
  const moment = h < 11 ? "Pour ce midi" : h < 15 ? "Pour ce midi" : "Pour ce soir";
  return (
    <div class="hero" key={r.id} role="button" tabIndex={0} onClick={() => openRecipe(r.id)}>
      <Cover r={r} small={false} />
      <div class="content">
        <span class="kicker">{ready ? "✓ " + moment + " · prêt avec ton frigo" : missing > 0 ? moment + " · il te manque " + missing : moment + " · idée du jour"}</span>
        <h2>{r.nom}</h2>
        <div class="meta">
          <span>⏱ {minutes(r)} min</span>
          <span>👥 {r.portions} pers.</span>
          <span>{r.diff}</span>
          <Stars id={r.id} compact />
        </div>
        <div class="actions">
          <button class="btn accent" onClick={(e) => (e.stopPropagation(), openRecipe(r.id))}>
            Voir la recette
          </button>
          <button
            class="btn light"
            onClick={(e) => {
              e.stopPropagation();
              setSeed(seed + 1);
            }}
          >
            <Icon name="dice" /> Une autre idée
          </button>
        </div>
      </div>
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3 }}>
        <FavButton id={r.id} class="iconbtn glass" />
      </div>
    </div>
  );
}

function CategoryTiles() {
  const all = allRecipes.value;
  const covers = useMemo(() => {
    const m: Record<string, Recipe | undefined> = {};
    const pick: Record<string, string> = { Plat: "bourguignon", Entrée: "soupeoignon", Accompagnement: "rizblanc", Dessert: "tatin", Apéro: "houmous", "Petit-déj": "pancakes" };
    CATEGORIES.forEach((c) => (m[c] = all.find((r) => r.id === pick[c]) || all.find((r) => r.cat === c && r.photo)));
    return m;
  }, [all.length]);
  return (
    <div class="cats">
      {CATEGORIES.map((c) => (
        <button class="cat" onClick={() => openOverlay({ kind: "explore", cat: c })}>
          {covers[c] && <Cover r={covers[c]!} />}
          <b>{CAT_LABEL[c]}</b>
        </button>
      ))}
    </div>
  );
}

function QuickCards() {
  const f = fridge.value;
  const prets = cookable(baseList()).length;
  const next = prochainRepas(agenda.value);
  const nextR = next ? allRecipes.value.find((r) => r.id === next.id) : null;
  const iNext = next ? joursAgenda().findIndex((d) => cleJour(d) === next.cle) : -1;
  const aAcheter = shopping.value.filter((s) => !s.checked).length;
  return (
    <div class="quick">
      <button class="qcard strong" onClick={() => (f.length ? openOverlay({ kind: "explore", preset: "cookable" }) : setTab("fridge"))}>
        <span class="ic">🧊</span>
        <b>{f.length ? count(prets, "recette prête", "recettes prêtes") : "Mon frigo"}</b>
        <span>{f.length ? "avec tes " + count(f.length, "ingrédient") : "Ajoute ce que tu as, on te dit quoi cuisiner"}</span>
      </button>
      <button class="qcard" onClick={() => setTab("week")}>
        <span class="ic">🗓️</span>
        <b>Ma semaine</b>
        <span>{nextR ? nextR.nom + " · " + libelleJour(joursAgenda()[iNext], iNext).toLowerCase() + " " + next!.repas : "Planifie tes repas en 1 minute"}</span>
      </button>
      <button class="qcard" onClick={() => setTab("shopping")}>
        <span class="ic">🛒</span>
        <b>Courses</b>
        <span>{aAcheter ? count(aAcheter, "article") + " à acheter" : "Ta liste est vide"}</span>
      </button>
      <button class="qcard" onClick={() => openOverlay({ kind: "editor" })}>
        <span class="ic">✍️</span>
        <b>Ajouter une recette</b>
        <span>La tienne, ou importée d'un site</span>
      </button>
    </div>
  );
}

function AntiGaspi() {
  const urgent = urgentItems(fridge.value);
  if (!urgent.length) return null;
  const n = antiGaspi().length;
  return (
    <div class="panel warn mt">
      <b>⏳ À consommer vite</b>
      <div class="urgent-list">
        {urgent.slice(0, 6).map((u) => {
          const d = daysUntil(u.exp)!;
          return <span class={"tag " + (d < 0 ? "danger" : "warn")}>{cap(u.n) + " · " + (d < 0 ? "périmé" : d === 0 ? "aujourd'hui" : d === 1 ? "demain" : "J-" + d)}</span>;
        })}
      </div>
      {n > 0 && (
        <button class="btn sm primary mt-s" onClick={() => openOverlay({ kind: "explore", preset: "antigaspi" })}>
          {count(n, "recette pour les utiliser", "recettes pour les utiliser")} ›
        </button>
      )}
    </div>
  );
}

export function Home() {
  const ready = catalogReady.value;
  const p = profile.value;
  const mois = nomMois(new Date().getMonth() + 1);
  const planned = plannedList();
  const favs = favList();
  const nouveautes = ready ? fresh() : [];
  return (
    <div>
      <header class="topbar">
        <img class="wordmark" src="/logo-wordmark.png" alt="Yummly" width="86" height="34" />
        <div class="grow" />
        <button class="iconbtn" aria-label="Réglages" onClick={() => openOverlay({ kind: "settings" })}>
          <Icon name="settings" />
        </button>
        <button
          aria-label={user.value ? "Mon profil" : "Se connecter"}
          onClick={() => (user.value ? openOverlay({ kind: "profile", id: user.value.id }) : openSheet("auth"))}
        >
          {user.value ? <Avatar avatar={p.avatar} name={displayName()} /> : <span class="iconbtn"><Icon name="user" /></span>}
        </button>
      </header>
      <p class="hello">
        {greeting()}
        {user.value ? " " + displayName() : ""} 👋
      </p>
      <h1 class="screen-title" style={{ margin: "2px 0 14px" }}>
        On mange quoi ?
      </h1>
      <button class="searchbar" style={{ width: "100%" }} onClick={() => openOverlay({ kind: "explore", q: "" })} aria-label="Rechercher une recette">
        <Icon name="search" class="lead" />
        <span class="input" style={{ display: "flex", alignItems: "center", color: "var(--muted)" }}>
          Un plat, un ingrédient…
        </span>
      </button>
      {cookMode.value !== "normal" && (
        <div class="callout info mt">
          <span class="ic">{cookMode.value === "airfryer" ? "🍟" : "🔆"}</span>
          <div class="grow">
            <b>Mode {cookMode.value === "airfryer" ? "air fryer" : "micro-ondes"} activé</b>
            Les recettes et les temps de cuisson sont adaptés.
          </div>
        </div>
      )}
      {!ready ? (
        <div class="skeleton mt" style={{ height: 300, borderRadius: 28 }} />
      ) : (
        <>
          <div class="mt">
            <Hero />
          </div>
          <AntiGaspi />
          <QuickCards />
          {planned.length > 0 && (
            <Section title="📌 À réaliser" link="Tout voir" onLink={() => openOverlay({ kind: "explore", preset: "planned" })}>
              <Shelf list={planned} />
            </Section>
          )}
          <Section title="Catégories">
            <CategoryTiles />
          </Section>
          <Section title="Recommandé pour toi" link="Explorer" onLink={() => openOverlay({ kind: "explore" })}>
            <Shelf list={recommended()} />
          </Section>
          {seasonal().length > 0 && (
            <Section title={"De saison en " + mois} link="Tout voir" onLink={() => openOverlay({ kind: "explore", preset: "saison" })}>
              <Shelf list={seasonal()} />
            </Section>
          )}
          <Section title="Prêt en 20 minutes" link="Tout voir" onLink={() => openOverlay({ kind: "explore", preset: "rapide" })}>
            <Shelf list={quick()} />
          </Section>
          {nouveautes.length > 0 && (
            <Section title="✨ Nouveautés" link="Tout voir" onLink={() => openOverlay({ kind: "explore", preset: "nouveau" })}>
              <Shelf list={nouveautes} />
            </Section>
          )}
          {favs.length > 0 && (
            <Section title="❤️ Tes favoris" link="Tout voir" onLink={() => openOverlay({ kind: "explore", preset: "favorites" })}>
              <Shelf list={favs.slice(0, 12)} />
            </Section>
          )}
          <Section title="Cuisines du monde">
            <div class="chips">
              {[
                ["fr", "🇫🇷 Française"],
                ["ital", "🇮🇹 Italienne"],
                ["asie", "🥢 Asiatique"],
                ["mex", "🌮 Mexicaine"],
                ["med", "🫒 Méditerranéenne"],
                ["orient", "🍢 Orientale"],
                ["us", "🍔 Américaine"]
              ].map(([id, l]) => (
                <button class="chip" onClick={() => openOverlay({ kind: "explore", cuisine: id })}>
                  {l}
                </button>
              ))}
            </div>
          </Section>
          <p class="center small muted mt-l">{allRecipes.value.length} recettes · photos des plats : TheMealDB et la communauté Yummly</p>
        </>
      )}
    </div>
  );
}
