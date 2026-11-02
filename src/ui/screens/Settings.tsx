import { ALLERGENES, AVERSIONS, cuisineDe, cuisineInfo } from "../../core/classify";
import { count, dateFr } from "../../core/text";
import { resetAccount, signOut } from "../../services/auth";
import { canSpeak, shareOrCopy } from "../../services/device";
import { setCookMode } from "../../state/actions";
import { allRecipes, cookMode, KEYS, localGet, semaine, settings, stats, theme, user, type Theme } from "../../state/store";
import { askConfirm, closeOverlay, openOverlay, openSheet, toast } from "../../state/ui";
import { Stepper, Switch } from "../components/common";
import { Icon } from "../components/Icon";

function Group({ title, children }: { title: string; children: any }) {
  return (
    <>
      <div class="group-title">{title}</div>
      <div class="list">{children}</div>
    </>
  );
}

export function SettingsScreen() {
  const s = settings.value;
  const set = (p: Partial<typeof s>) => (settings.value = { ...s, ...p });
  const prefs = semaine.value.prefs;
  const toggle = (k: "allerg" | "deteste", id: string) => {
    const l = prefs[k];
    semaine.value = { ...semaine.value, prefs: { ...prefs, [k]: l.includes(id) ? l.filter((x) => x !== id) : [...l, id] } };
  };
  const exportData = async () => {
    const data: Record<string, unknown> = { app: "Yummly", exportedAt: new Date().toISOString() };
    KEYS.forEach((k) => (data[k] = localGet(k)));
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "yummly-sauvegarde.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const themes: [Theme, string, string][] = [
    ["auto", "Auto", "sun"],
    ["light", "Clair", "sun"],
    ["dark", "Sombre", "moon"]
  ];
  return (
    <div class="overlay" role="dialog" aria-label="Réglages">
      <div class="ov-inner">
        <div class="ov-head">
          <button class="iconbtn" aria-label="Retour" onClick={closeOverlay}>
            <Icon name="back" />
          </button>
          <h1>Réglages</h1>
        </div>

        <Group title="Apparence">
          <div class="setrow">
            <span class="grow">Thème</span>
            <div class="seg">
              {themes.map(([v, l]) => (
                <button class={theme.value === v ? "on" : ""} onClick={() => (theme.value = v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </Group>

        <Group title="Ma cuisine">
          <div class="setrow">
            <span class="grow">
              Appareil de cuisson
              <small>Les recettes et leurs étapes s'adaptent</small>
            </span>
          </div>
          <div class="setrow" style={{ borderTop: 0, paddingTop: 0 }}>
            <div class="seg" style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
              <button class={cookMode.value === "normal" ? "on" : ""} onClick={() => (cookMode.value = "normal")}>
                Four & plaques
              </button>
              <button class={cookMode.value === "airfryer" ? "on" : ""} onClick={() => setCookMode("airfryer")}>
                🍟 Air fryer
              </button>
              <button class={cookMode.value === "micro" ? "on" : ""} onClick={() => setCookMode("micro")}>
                🔆 Micro-ondes
              </button>
            </div>
          </div>
          <div class="setrow">
            <span class="grow">
              Nombre de personnes par défaut
              <small>{s.personnes ? "Les recettes s'ouvrent pour " + s.personnes : "Celui de chaque recette"}</small>
            </span>
            <Stepper value={s.personnes} min={0} max={20} onChange={(v) => set({ personnes: v })} label={(v) => (v ? v + " pers." : "Auto")} />
          </div>
          {canSpeak() && (
            <label class="setrow">
              <span class="grow">
                Lire les étapes à voix haute
                <small>En mode cuisine, mains libres</small>
              </span>
              <Switch checked={s.voix} label="Lecture à voix haute" onChange={(v) => set({ voix: v })} />
            </label>
          )}
        </Group>

        <Group title="Mes préférences alimentaires">
          <label class="setrow">
            <span class="grow">
              🌱 Végétarien
              <small>Ne me proposer que des recettes sans viande ni poisson</small>
            </span>
            <Switch checked={s.vege} label="Végétarien" onChange={(v) => set({ vege: v })} />
          </label>
          <label class="setrow">
            <span class="grow">
              Appliquer mes allergies et aversions partout
              <small>Sinon, seulement pour le planning de la semaine</small>
            </span>
            <Switch checked={s.appliquerPrefs} label="Appliquer partout" onChange={(v) => set({ appliquerPrefs: v })} />
          </label>
          <div class="setrow" style={{ display: "block" }}>
            <div class="label">Allergies</div>
            <div class="chips wrap mt-s">
              {ALLERGENES.map((x) => (
                <button class={"chip" + (prefs.allerg.includes(x.id) ? " on" : "")} onClick={() => toggle("allerg", x.id)}>
                  {x.nom}
                </button>
              ))}
            </div>
            <div class="label mt">Je n'aime pas</div>
            <div class="chips wrap mt-s">
              {AVERSIONS.map((x) => (
                <button class={"chip" + (prefs.deteste.includes(x.id) ? " on" : "")} onClick={() => toggle("deteste", x.id)}>
                  {x.nom}
                </button>
              ))}
            </div>
          </div>
        </Group>

        <Group title="Compte">
          {user.value ? (
            <>
              <div class="setrow">
                <Icon name="user" />
                <span class="grow">
                  {user.value.email}
                  <small>Tes données sont synchronisées sur tous tes appareils</small>
                </span>
              </div>
              <button class="setrow" onClick={() => openOverlay({ kind: "profile", id: user.value!.id })}>
                <span class="grow">Mon profil</span>
                <Icon name="chevron" />
              </button>
              <button class="setrow" onClick={() => openSheet("profileEdit")}>
                <span class="grow">Modifier le profil</span>
                <Icon name="chevron" />
              </button>
              <button
                class="setrow"
                onClick={() => {
                  closeOverlay();
                  void signOut();
                }}
              >
                <Icon name="logout" />
                <span class="grow">Se déconnecter</span>
              </button>
            </>
          ) : (
            <button class="setrow" onClick={() => openSheet("auth")}>
              <Icon name="user" />
              <span class="grow">
                Se connecter ou créer un compte
                <small>Pour retrouver tes données partout et partager tes plats</small>
              </span>
              <Icon name="chevron" />
            </button>
          )}
        </Group>

        <Group title="Mes données">
          <button class="setrow" onClick={() => openOverlay({ kind: "stats" })}>
            <span class="grow">Mes statistiques</span>
            <Icon name="chevron" />
          </button>
          <button class="setrow" onClick={() => openSheet("paste")}>
            <span class="grow">
              Importer un lien reçu
              <small>Une recette ou un frigo envoyé par message</small>
            </span>
            <Icon name="link" />
          </button>
          {!user.value && (
            <button class="setrow" onClick={exportData}>
              <span class="grow">
                Télécharger une sauvegarde
                <small>Toutes tes données de cet appareil, en un fichier</small>
              </span>
              <Icon name="download" />
            </button>
          )}
          <button
            class="setrow danger"
            onClick={() =>
              askConfirm({
                title: "Réinitialiser ?",
                text: user.value
                  ? "Efface DÉFINITIVEMENT frigo, courses, recettes, profil, publications et amis, puis te déconnecte. Irréversible."
                  : "Efface définitivement toutes les données de cet appareil.",
                ok: "Tout effacer",
                danger: true,
                onOk: () => {
                  closeOverlay();
                  void resetAccount();
                }
              })
            }
          >
            <Icon name="trash" />
            <span class="grow">Réinitialiser {user.value ? "le compte" : "l'application"}</span>
          </button>
        </Group>

        <Group title="À propos">
          <div class="setrow">
            <span class="grow">
              Yummly · version 2
              <small>{allRecipes.value.length} recettes. Photos des plats : TheMealDB (CC BY-SA) et la communauté. Données produits : Open Food Facts.</small>
            </span>
          </div>
          <button
            class="setrow"
            onClick={async () => {
              const r = await shareOrCopy({ title: "Yummly", text: "Je cuisine avec Yummly : recettes, frigo, courses et planning 🍳", url: location.origin });
              if (r === "copied") toast("📋 Lien copié");
            }}
          >
            <span class="grow">Faire découvrir Yummly</span>
            <Icon name="share" />
          </button>
        </Group>
      </div>
    </div>
  );
}

export function StatsScreen() {
  const s = stats.value;
  const by = s.byRecipe || {};
  const all = allRecipes.value;
  const top = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ r: all.find((x) => x.id === id), n }))
    .filter((x) => x.r);
  const cuisines: Record<string, number> = {};
  Object.entries(by).forEach(([id, n]) => {
    const r = all.find((x) => x.id === id);
    if (r) cuisines[cuisineDe(r)] = (cuisines[cuisineDe(r)] || 0) + n;
  });
  const distinct = Object.keys(by).length;
  const h = s.history || [];
  const semaine = h.filter((x) => Date.now() - x.at < 7 * 86400000).length;
  return (
    <div class="overlay">
      <div class="ov-inner">
        <div class="ov-head">
          <button class="iconbtn" aria-label="Retour" onClick={closeOverlay}>
            <Icon name="back" />
          </button>
          <h1>Mes statistiques</h1>
        </div>
        <div class="quick" style={{ marginTop: 0 }}>
          <div class="qcard strong">
            <span class="ic">🔥</span>
            <b>{s.cooked}</b>
            <span>{s.cooked > 1 ? "plats cuisinés" : "plat cuisiné"}</span>
          </div>
          <div class="qcard">
            <span class="ic">📖</span>
            <b>{distinct}</b>
            <span>{distinct > 1 ? "recettes différentes" : "recette différente"}</span>
          </div>
          <div class="qcard">
            <span class="ic">📅</span>
            <b>{semaine}</b>
            <span>ces 7 derniers jours</span>
          </div>
          <div class="qcard">
            <span class="ic">🌍</span>
            <b>{Object.keys(cuisines).length}</b>
            <span>cuisines explorées</span>
          </div>
        </div>
        {s.firstAt && <p class="small muted mt">En cuisine avec Yummly depuis le {dateFr(s.firstAt)}.</p>}
        {top.length > 0 && (
          <>
            <div class="group-title">Tes plats préférés</div>
            <div class="list">
              {top.map(({ r, n }) => (
                <button class="item" style={{ width: "100%", textAlign: "left" }} onClick={() => openOverlay({ kind: "recipe", id: r!.id })}>
                  <span class="em">{r!.emoji}</span>
                  <span class="nm">
                    <b>{r!.nom}</b>
                  </span>
                  <span class="tag">{count(n, "fois", "fois")}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {Object.keys(cuisines).length > 0 && (
          <>
            <div class="group-title">Par cuisine</div>
            <div class="chips wrap">
              {Object.entries(cuisines)
                .sort((a, b) => b[1] - a[1])
                .map(([c, n]) => (
                  <span class="tag accent">
                    {cuisineInfo(c).emoji} {cuisineInfo(c).nom} · {n}
                  </span>
                ))}
            </div>
          </>
        )}
        {!s.cooked && <p class="muted mt">Cuisine un premier plat et touche « J'ai cuisiné ce plat » : tes statistiques apparaîtront ici.</p>}
      </div>
    </div>
  );
}
