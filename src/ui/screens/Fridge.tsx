import { useState } from "preact/hooks";
import { aisleInfo, aisleOf, emojiOf, productInfo } from "../../core/catalog";
import { addDays, daysUntil, freshness, isoDate, urgentItems, type FridgeItem } from "../../core/fridge";
import { encodeSync } from "../../core/links";
import { COMMON } from "../../core/tables";
import { cap, count, norm } from "../../core/text";
import { parseQty, UNIT_OPTS } from "../../core/units";
import { shareOrCopy } from "../../services/device";
import { addFridge, clearFridge, removeFridgeItem, updateFridgeItem } from "../../state/actions";
import { fridge, shopping } from "../../state/store";
import { askConfirm, openOverlay, openSheet, toast } from "../../state/ui";
import { Empty, IngredientInput, Sheet } from "../components/common";
import { Icon } from "../components/Icon";
import { baseList, cookable } from "./lists";

export function ExpBadge({ exp }: { exp?: string | null }) {
  const fr = freshness(exp);
  if (!fr) return null;
  const d = daysUntil(exp)!;
  const txt = d < 0 ? "périmé" : d === 0 ? "aujourd'hui" : d === 1 ? "demain" : d <= 30 ? "J-" + d : new Date(exp + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return <span class={"exp " + fr}>{txt}</span>;
}

function UnitSelect({ value, onChange, label }: { value: string; onChange: (u: string) => void; label?: string }) {
  return (
    <select class="select" value={value} aria-label={label || "Unité"} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
      {UNIT_OPTS.map(([v, l]) => (
        <option value={v}>{l}</option>
      ))}
      {!UNIT_OPTS.some(([v]) => v === value) && <option value={value}>{value}</option>}
    </select>
  );
}
export { UnitSelect };

function EditItemSheet({ index, onClose }: { index: number; onClose: () => void }) {
  const it = fridge.value[index];
  const [q, setQ] = useState(it && it.q != null ? String(it.q).replace(".", ",") : "");
  const [u, setU] = useState(it ? it.u : "");
  const [exp, setExp] = useState(it && it.exp ? it.exp : "");
  if (!it) return null;
  const shelf = productInfo(it.n).shelf;
  return (
    <Sheet onClose={onClose} labelledBy="edit-it">
      <h2 id="edit-it">
        {emojiOf(it.n)} {cap(it.n)}
      </h2>
      <div class="row mt">
        <label class="field grow">
          <span>Quantité</span>
          <input class="input" inputMode="decimal" value={q} placeholder="—" onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field" style={{ width: 120 }}>
          <span>Unité</span>
          <UnitSelect value={u} onChange={setU} />
        </label>
      </div>
      <label class="field mt">
        <span>À consommer avant le</span>
        <input class="input" type="date" value={exp} onInput={(e) => setExp((e.target as HTMLInputElement).value)} />
      </label>
      <div class="chips wrap mt-s">
        <button class="chip" onClick={() => setExp(addDays(0))}>
          Aujourd'hui
        </button>
        <button class="chip" onClick={() => setExp(addDays(2))}>
          Dans 2 j
        </button>
        <button class="chip" onClick={() => setExp(addDays(7))}>
          Dans 1 sem.
        </button>
        {shelf != null && (
          <button class="chip" onClick={() => setExp(addDays(shelf))}>
            Estimation ({shelf} j)
          </button>
        )}
        {exp && (
          <button class="chip" onClick={() => setExp("")}>
            Sans date
          </button>
        )}
      </div>
      <div class="sheet-actions">
        <button
          class="btn danger"
          onClick={() => {
            onClose();
            removeFridgeItem(index);
          }}
        >
          <Icon name="trash" /> Retirer
        </button>
        <button
          class="btn primary"
          onClick={() => {
            updateFridgeItem(index, { q: parseQty(q), u, exp: exp || null });
            onClose();
          }}
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function ItemRow({ f, i, onEdit }: { f: FridgeItem; i: number; onEdit: () => void }) {
  const [q, setQ] = useState<string | null>(null);
  const commit = () => {
    if (q == null) return;
    updateFridgeItem(i, { q: parseQty(q) });
    setQ(null);
  };
  return (
    <div class="item">
      <span class="em" aria-hidden="true">
        {emojiOf(f.n)}
      </span>
      <button class="nm" style={{ textAlign: "left" }} onClick={onEdit}>
        <b>{cap(f.n)}</b>
        {f.exp ? <ExpBadge exp={f.exp} /> : <small>+ date</small>}
      </button>
      <div class="qty">
        <input
          class="input"
          inputMode="decimal"
          aria-label={"Quantité de " + f.n}
          value={q != null ? q : f.q != null ? String(f.q).replace(".", ",") : ""}
          placeholder="—"
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <UnitSelect value={f.u} onChange={(u) => updateFridgeItem(i, { u })} />
      </div>
      <button class="del" aria-label={"Retirer " + f.n} onClick={() => removeFridgeItem(i)}>
        <Icon name="trash" />
      </button>
    </div>
  );
}

export function FridgeScreen() {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [u, setU] = useState("");
  const [exp, setExp] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const list = fridge.value;
  const urgent = urgentItems(list);
  const prets = cookable(baseList()).length;
  const add = (n = name) => {
    if (!n.trim()) return;
    const nom = addFridge(n, parseQty(q), u, exp || null);
    if (nom) toast("🧊 « " + cap(nom) + " » rangé dans le frigo");
    setName("");
    setQ("");
    setExp("");
    setShowDate(false);
  };
  // regroupement : à consommer vite, puis par rayon
  const idx = list.map((f, i) => ({ f, i }));
  const urgentIdx = idx.filter((x) => urgent.includes(x.f)).sort((a, b) => (a.f.exp || "").localeCompare(b.f.exp || ""));
  const autres = idx.filter((x) => !urgent.includes(x.f));
  const groups = new Map<string, typeof idx>();
  autres.forEach((x) => {
    const a = aisleOf(x.f.n);
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a)!.push(x);
  });
  const have = new Set(list.map((f) => norm(f.n)));
  const transfer = async () => {
    if (!list.length && !shopping.value.length) return toast("Rien à transférer pour le moment");
    const url = location.origin + "/?sync=" + encodeSync(list, shopping.value);
    if (url.length > 7000) return toast("Liste trop longue pour tenir dans un lien");
    const r = await shareOrCopy({ title: "Mon frigo Yummly", text: "🧊 Mon frigo Yummly — ouvre ce lien sur l'autre appareil :", url });
    if (r === "copied") toast("📋 Lien copié — ouvre-le sur l'autre appareil");
  };
  return (
    <div>
      <header class="topbar">
        <div class="grow">
          <h1 class="screen-title">Mon frigo</h1>
          <p class="screen-sub">{list.length ? count(list.length, "produit") + (urgent.length ? " · " + urgent.length + " à consommer vite" : "") : "Ce que tu as sous la main"}</p>
        </div>
        <button class="iconbtn" aria-label="Scanner un produit" onClick={() => openOverlay({ kind: "scanner" })}>
          <Icon name="scan" />
        </button>
      </header>

      <div class="panel">
        <div class="addbox">
          <div class="wide">
            <IngredientInput value={name} onInput={setName} onPick={(n) => setName(n)} placeholder="Ajouter un produit (ex. 6 œufs, crème…)" onEnter={() => add()} />
          </div>
          <input class="input" inputMode="decimal" placeholder="Qté" value={q} aria-label="Quantité" onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <UnitSelect value={u} onChange={setU} />
          {showDate ? (
            <input class="input" type="date" aria-label="Date limite" value={exp} min={isoDate(new Date())} onInput={(e) => setExp((e.target as HTMLInputElement).value)} />
          ) : (
            <button class="btn" onClick={() => setShowDate(true)} aria-label="Ajouter une date limite">
              📅 Date
            </button>
          )}
          <button class="btn primary wide" onClick={() => add()} disabled={!name.trim()}>
            <Icon name="plus" /> Ranger
          </button>
        </div>
      </div>

      {list.length > 0 && (
        <button class="panel brand mt" style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }} onClick={() => openOverlay({ kind: "explore", preset: "cookable" })}>
          <span style={{ fontSize: 28 }}>👩‍🍳</span>
          <span class="grow">
            <b style={{ display: "block", fontSize: 17 }}>{prets ? count(prets, "recette prête", "recettes prêtes") + " à cuisiner" : "Que cuisiner avec ça ?"}</b>
            <span class="small" style={{ opacity: 0.8 }}>
              {prets ? "avec ce que tu as (hors sel, poivre, huile…)" : "Voir les recettes où il manque peu de choses"}
            </span>
          </span>
          <Icon name="chevron" size={22} />
        </button>
      )}

      {!list.length ? (
        <Empty icon="🧊" title="Ton frigo est vide" text="Ajoute ce que tu as : Yummly te dira ce que tu peux cuisiner, et décomptera les quantités quand tu cuisines." />
      ) : (
        <>
          {urgentIdx.length > 0 && (
            <>
              <div class="group-title">
                ⏳ À consommer vite <span class="n">{urgentIdx.length}</span>
              </div>
              <div class="list">
                {urgentIdx.map(({ f, i }) => (
                  <ItemRow f={f} i={i} key={f.n + i} onEdit={() => setEditing(i)} />
                ))}
              </div>
            </>
          )}
          {[...groups.entries()].map(([a, items]) => {
            const info = aisleInfo(a as any);
            return (
              <>
                <div class="group-title">
                  {info.emoji} {info.nom} <span class="n">{items.length}</span>
                </div>
                <div class="list">
                  {items.map(({ f, i }) => (
                    <ItemRow f={f} i={i} key={f.n + i} onEdit={() => setEditing(i)} />
                  ))}
                </div>
              </>
            );
          })}
        </>
      )}

      <div class="group-title">⚡ Ajouter rapidement</div>
      <div class="chips wrap">
        {COMMON.filter((c) => !have.has(norm(c.n))).map((c) => (
          <button
            class="chip"
            onClick={() => {
              addFridge(c.n, c.q, c.u, null);
              toast("🧊 « " + c.n + " » ajouté");
            }}
          >
            {emojiOf(c.n)} {c.n}
          </button>
        ))}
      </div>

      <div class="group-title">🔁 Autre appareil</div>
      <div class="row wrap">
        <button class="btn sm" onClick={transfer}>
          <Icon name="upload" /> Transférer mon frigo
        </button>
        <button class="btn sm" onClick={() => openSheet("paste")}>
          <Icon name="link" /> Importer un lien reçu
        </button>
        {list.length > 0 && (
          <button
            class="btn sm danger"
            onClick={() => askConfirm({ title: "Vider le frigo ?", text: "Tous les produits seront retirés (tu pourras annuler).", ok: "Vider", danger: true, onOk: clearFridge })}
          >
            <Icon name="trash" /> Vider
          </button>
        )}
      </div>
      <p class="hint">Connecte-toi pour retrouver ton frigo automatiquement sur tous tes appareils.</p>
      {editing != null && <EditItemSheet index={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
