import { useState } from "preact/hooks";
import { emojiOf } from "../../core/catalog";
import { cheapestStore, euros, prixCourses, priciestStore } from "../../core/pricing";
import { byAisle, shoppingText } from "../../core/shopping";
import { count } from "../../core/text";
import { fmtNum, parseQty } from "../../core/units";
import { shareOrCopy } from "../../services/device";
import { addShopping, clearShopping, removeShopping, stockChecked, toggleShopping, updateShopping } from "../../state/actions";
import { shopping, type ShoppingItem } from "../../state/store";
import { askConfirm, openOverlay, toast } from "../../state/ui";
import { Empty, IngredientInput, Sheet } from "../components/common";
import { Icon } from "../components/Icon";
import { UnitSelect } from "./Fridge";

function EditSheet({ it, onClose }: { it: ShoppingItem; onClose: () => void }) {
  const [label, setLabel] = useState(it.label);
  const [q, setQ] = useState(it.q != null ? String(it.q).replace(".", ",") : "");
  const [u, setU] = useState(it.u);
  return (
    <Sheet onClose={onClose} labelledBy="ed-sh">
      <h2 id="ed-sh">Modifier l'article</h2>
      <label class="field mt">
        <span>Article</span>
        <input class="input" value={label} onInput={(e) => setLabel((e.target as HTMLInputElement).value)} />
      </label>
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
      {it.from && <p class="hint">Pour : {it.from}</p>}
      <div class="sheet-actions">
        <button
          class="btn danger"
          onClick={() => {
            onClose();
            removeShopping(it.id);
          }}
        >
          <Icon name="trash" /> Retirer
        </button>
        <button
          class="btn primary"
          onClick={() => {
            updateShopping(it.id, { label: label.trim() || it.label, q: parseQty(q), u });
            onClose();
          }}
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function Row({ s, onEdit }: { s: ShoppingItem; onEdit: () => void }) {
  return (
    <div class={"item" + (s.checked ? " checked" : "")}>
      <button class={"check" + (s.checked ? " on" : "")} role="checkbox" aria-checked={s.checked} aria-label={(s.checked ? "Décocher " : "Cocher ") + s.label} onClick={() => toggleShopping(s.id)}>
        <Icon name="check" />
      </button>
      <span class="em" aria-hidden="true">
        {emojiOf(s.base || s.label)}
      </span>
      <button class="nm" style={{ textAlign: "left" }} onClick={() => toggleShopping(s.id)}>
        <b>{s.label}</b>
        {s.from && <small>pour {s.from}</small>}
      </button>
      {s.q != null && (
        <button class="tag" onClick={onEdit} aria-label="Modifier la quantité">
          {fmtNum(s.q)}
          {s.u ? " " + s.u : ""}
        </button>
      )}
      <button class="del" aria-label={"Options pour " + s.label} onClick={onEdit}>
        <Icon name="more" />
      </button>
    </div>
  );
}

export function ShoppingScreen() {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [u, setU] = useState("");
  const [edit, setEdit] = useState<ShoppingItem | null>(null);
  const list = shopping.value;
  const todo = list.filter((s) => !s.checked);
  const done = list.filter((s) => s.checked);
  const p = prixCourses(list);
  const [minN, minI] = cheapestStore(),
    [maxN, maxI] = priciestStore();
  const add = () => {
    if (!name.trim()) return;
    const merged = addShopping(name, parseQty(q), u);
    toast(merged ? "Quantité ajoutée à l'article existant" : "Ajouté à la liste");
    setName("");
    setQ("");
  };
  const share = async () => {
    const r = await shareOrCopy({ title: "Liste de courses", text: shoppingText(list) });
    if (r === "copied") toast("📋 Liste copiée — colle-la dans un message");
  };
  return (
    <div>
      <header class="topbar">
        <div class="grow">
          <h1 class="screen-title">Courses</h1>
          <p class="screen-sub">{list.length ? count(todo.length, "article") + " à acheter" + (done.length ? " · " + done.length + " dans le caddie" : "") : "Ta liste se remplit depuis les recettes"}</p>
        </div>
        {list.length > 0 && (
          <button class="iconbtn" aria-label="Partager la liste" onClick={share}>
            <Icon name="share" />
          </button>
        )}
      </header>

      <div class="panel">
        <div class="row">
          <IngredientInput value={name} onInput={setName} onPick={(n) => setName(n)} placeholder="Ajouter un article…" onEnter={add} />
        </div>
        <div class="row mt-s">
          <input class="input" style={{ width: 90 }} inputMode="decimal" placeholder="Qté" aria-label="Quantité" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <div style={{ width: 110 }}>
            <UnitSelect value={u} onChange={setU} />
          </div>
          <button class="btn primary grow" onClick={add} disabled={!name.trim()}>
            <Icon name="plus" /> Ajouter
          </button>
        </div>
      </div>
      <button class="btn block mt" onClick={() => openOverlay({ kind: "scanner" })}>
        <Icon name="scan" /> Scanner mes articles en magasin
      </button>

      {!list.length ? (
        <Empty icon="🛒" title="Ta liste est vide" text="Ouvre une recette et ajoute ce qui te manque, ou envoie toute ta semaine en un geste depuis l'onglet Semaine." />
      ) : (
        <>
          {p.total > 0 && (
            <div class="panel tint mt">
              <div class="totalbox">
                <span>
                  <span class="small muted">Total estimé</span>
                  <br />
                  <b>≈ {euros(p.total)}</b>
                </span>
                <span class="small" style={{ textAlign: "right" }}>
                  {done.length > 0 && (
                    <>
                      Reste <b>{euros(p.reste)}</b>
                      <br />
                    </>
                  )}
                  ≈ {euros(p.total * minI)} chez {minN}
                  <br />≈ {euros(p.total * maxI)} chez {maxN}
                </span>
              </div>
              {p.inconnus > 0 && <p class="hint">{count(p.inconnus, "article")} non chiffré{p.inconnus > 1 ? "s" : ""}.</p>}
            </div>
          )}
          {byAisle(todo).map((g) => (
            <>
              <div class="group-title">
                {g.emoji} {g.nom} <span class="n">{g.items.length}</span>
              </div>
              <div class="list">
                {g.items.map((s) => (
                  <Row s={s} key={s.id} onEdit={() => setEdit(s)} />
                ))}
              </div>
            </>
          ))}
          {done.length > 0 && (
            <>
              <div class="group-title">
                ✅ Dans le caddie <span class="n">{done.length}</span>
              </div>
              <div class="list">
                {done.map((s) => (
                  <Row s={s} key={s.id} onEdit={() => setEdit(s)} />
                ))}
              </div>
              <div class="sticky-cta">
                <button class="btn primary lg block" onClick={() => stockChecked()}>
                  🧊 Ranger {count(done.length, "produit")} dans le frigo
                </button>
              </div>
            </>
          )}
          <div class="row wrap mt">
            {done.length > 0 && (
              <button class="btn sm" onClick={() => clearShopping(true)}>
                Retirer les cochés
              </button>
            )}
            <button class="btn sm danger" onClick={() => askConfirm({ title: "Vider la liste ?", text: "Tous les articles seront retirés (tu pourras annuler).", ok: "Vider", danger: true, onOk: () => clearShopping(false) })}>
              <Icon name="trash" /> Vider la liste
            </button>
          </div>
          <p class="hint">Les produits rangés depuis la liste reçoivent une date limite estimée (modifiable dans le frigo).</p>
        </>
      )}
      {edit && <EditSheet it={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
