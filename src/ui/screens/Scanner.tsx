import { useEffect, useRef, useState } from "preact/hooks";
import { emojiOf, productInfo } from "../../core/catalog";
import { addDays } from "../../core/fridge";
import { ingKey, pantryName } from "../../core/ingredients";
import { codeBarreValide, produitVersArticle } from "../../core/off";
import { cap } from "../../core/text";
import { comparable, fmtNum, fromBase, parseQty, roundNice, toBase } from "../../core/units";
import { decodeImageFile, lookupProduct, startScanner, type ScanSession } from "../../services/scanner";
import { vibrate } from "../../services/device";
import { addFridge, stockChecked } from "../../state/actions";
import { shopping } from "../../state/store";
import { closeOverlay, toast } from "../../state/ui";
import { IngredientInput } from "../components/common";
import { Icon } from "../components/Icon";
import { UnitSelect } from "./Fridge";

/* Scanner un produit, c'est le mettre dans le caddie : l'article de la liste est COCHÉ et
   sa quantité prévue est remplacée par celle du produit réel. S'il était déjà coché,
   on cumule (deux pots achetés). */
function ajouteAuxCourses(nom: string, q: number | null, u: string): { id: number; geste: string } | null {
  const v = cap(pantryName(nom));
  if (!v) return null;
  const list = shopping.value.map((s) => ({ ...s }));
  const ex = list.find((s) => ingKey(s.base) === ingKey(v));
  let id: number, geste: string;
  if (ex) {
    if (ex.checked && q != null && ex.q != null && comparable(ex.u, u)) {
      ex.q = roundNice(fromBase(toBase(ex.q, ex.u) + toBase(q, u), ex.u));
      geste = "quantité cumulée";
    } else {
      if (q != null) {
        ex.q = roundNice(q);
        ex.u = u || "";
      }
      geste = ex.checked ? "quantité mise à jour" : "coché dans ta liste";
    }
    ex.checked = true;
    id = ex.id;
  } else {
    id = list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    list.push({ id, label: v, base: v, q: q == null ? null : roundNice(q), u: u || "", from: "", checked: true });
    geste = "ajouté à ta liste";
  }
  shopping.value = list;
  return { id, geste };
}

export function Scanner() {
  const [mode, setMode] = useState<"courses" | "frigo">(shopping.value.length ? "courses" : "frigo");
  const [status, setStatus] = useState<{ msg: string; err?: boolean }>({ msg: "Démarrage de la caméra…" });
  const [manual, setManual] = useState<{ code?: string; nom: string } | null>(null);
  const [mq, setMq] = useState("");
  const [mu, setMu] = useState("");
  const [flash, setFlash] = useState<number | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<ScanSession | null>(null);
  const last = useRef({ code: "", at: 0 });
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const range = (nom: string, q: number | null, u: string) => {
    if (modeRef.current === "courses") {
      const r = ajouteAuxCourses(nom, q, u);
      if (r) {
        setFlash(r.id);
        setStatus({ msg: "« " + cap(nom) + " » " + r.geste + (q != null ? " · " + fmtNum(q) + (u ? " " + u : "") : "") + " — scanne le suivant" });
      }
    } else {
      const shelf = productInfo(nom).shelf;
      const n = addFridge(nom, q, u, shelf != null ? addDays(shelf) : null);
      if (n) {
        setAdded((a) => [cap(n) + (q != null ? " · " + fmtNum(q) + (u ? " " + u : "") : ""), ...a].slice(0, 12));
        setStatus({ msg: "« " + cap(n) + " » rangé dans le frigo — scanne le suivant" });
      }
    }
  };

  const onCode = async (raw: string) => {
    const code = String(raw || "").replace(/\D/g, "");
    if (code.length < 8 || !codeBarreValide(code)) return;
    const t = Date.now();
    if (code === last.current.code && t - last.current.at < 4000) return;
    last.current = { code, at: t };
    vibrate(40);
    setStatus({ msg: "Code lu, recherche du produit…" });
    const prod = await lookupProduct(code);
    if (!prod) {
      setStatus({ msg: "Code " + code + " inconnu. Nomme le produit ci-dessous.", err: true });
      setManual({ code, nom: "" });
      return;
    }
    const a = produitVersArticle(prod);
    if (!a) {
      setStatus({ msg: "Produit trouvé mais sans nom exploitable.", err: true });
      setManual({ code, nom: prod.product_name_fr || prod.product_name || "" });
      return;
    }
    range(a.nom, a.q, a.u);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!video.current) return;
      const s = await startScanner(video.current, (c) => void onCode(c), (msg, err) => alive && setStatus({ msg, err }));
      if (!alive) s && s.stop();
      else session.current = s;
    })();
    return () => {
      alive = false;
      session.current && session.current.stop();
    };
  }, []);

  const photo = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files && input.files[0];
    if (!f) return;
    setStatus({ msg: "Lecture de la photo…" });
    const code = await decodeImageFile(f);
    input.value = "";
    if (code) void onCode(code);
    else setStatus({ msg: "Aucun code lisible sur la photo. Cadre bien le code, sans reflet.", err: true });
  };

  const pris = shopping.value.filter((s) => s.checked).length;
  return (
    <div class="overlay" role="dialog" aria-label="Scanner">
      <div class="ov-inner">
        <div class="ov-head">
          <button class="iconbtn" aria-label="Fermer" onClick={closeOverlay}>
            <Icon name="close" />
          </button>
          <h1>Scanner</h1>
        </div>
        <div class="seg" role="tablist" style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <button role="tab" aria-selected={mode === "courses"} class={mode === "courses" ? "on" : ""} onClick={() => setMode("courses")}>
            🛒 Je fais mes courses
          </button>
          <button role="tab" aria-selected={mode === "frigo"} class={mode === "frigo" ? "on" : ""} onClick={() => setMode("frigo")}>
            🧊 Je range au frigo
          </button>
        </div>
        <div class="scan-video mt">
          <video ref={video} playsInline muted autoPlay />
          <div class="frame" />
        </div>
        <p class={"scan-status" + (status.err ? " err" : "")} role="status">
          {status.msg}
        </p>
        <div class="row mt-s" style={{ justifyContent: "center" }}>
          <label class="btn sm">
            <Icon name="camera" /> Photographier le code
            <input type="file" accept="image/*" capture="environment" hidden onChange={photo} />
          </label>
          <button class="btn sm" onClick={() => setManual({ nom: "" })}>
            <Icon name="edit" /> Saisir à la main
          </button>
        </div>
        {manual && (
          <div class="panel mt">
            <b>{manual.code ? "Produit inconnu (" + manual.code + ")" : "Ajouter un produit"}</b>
            <div class="row mt-s">
              <IngredientInput value={manual.nom} onInput={(v) => setManual({ ...manual, nom: v })} placeholder="Ex. crème, poivrons, riz…" autoFocus />
            </div>
            <div class="row mt-s">
              <input class="input" style={{ width: 90 }} inputMode="decimal" placeholder="Qté" value={mq} onInput={(e) => setMq((e.target as HTMLInputElement).value)} />
              <div style={{ width: 110 }}>
                <UnitSelect value={mu} onChange={setMu} />
              </div>
              <button
                class="btn primary grow"
                disabled={!manual.nom.trim()}
                onClick={() => {
                  range(manual.nom, parseQty(mq), mu);
                  setManual(null);
                  setMq("");
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        )}
        {mode === "courses" ? (
          shopping.value.length > 0 && (
            <>
              <div class="group-title">
                Ma liste <span class="n">{pris + " / " + shopping.value.length + " dans le caddie"}</span>
              </div>
              <div class="list">
                {shopping.value.map((s) => (
                  <div class={"item" + (s.checked ? " checked" : "") + (flash === s.id ? " flash" : "")} key={s.id + (flash === s.id ? "f" : "")}>
                    <span class={"check" + (s.checked ? " on" : "")}>
                      <Icon name="check" />
                    </span>
                    <span class="em">{emojiOf(s.base)}</span>
                    <span class="nm">
                      <b>{s.label}</b>
                    </span>
                    {s.q != null && <span class="tag">{fmtNum(s.q) + (s.u ? " " + s.u : "")}</span>}
                  </div>
                ))}
              </div>
              {pris > 0 && (
                <button
                  class="btn primary block mt"
                  onClick={() => {
                    stockChecked();
                    toast("🧊 Rangé dans le frigo");
                  }}
                >
                  🧊 Ranger les {pris} produits dans le frigo
                </button>
              )}
            </>
          )
        ) : (
          added.length > 0 && (
            <>
              <div class="group-title">Rangé à l'instant</div>
              <div class="chips wrap">
                {added.map((a) => (
                  <span class="tag ok">✓ {a}</span>
                ))}
              </div>
            </>
          )
        )}
        <p class="hint mt">Données produits : Open Food Facts. La caméra n'est utilisée que pendant le scan.</p>
      </div>
    </div>
  );
}
