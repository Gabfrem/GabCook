import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { urgentItems } from "../core/fridge";
import { incoming } from "../services/social";
import { fridge, shopping } from "../state/store";
import { overlays, setTab, tab, TABS, type Overlay, type Tab } from "../state/ui";
import { ConfirmDialog, Toast } from "./components/common";
import { Icon } from "./components/Icon";
import { CookMode, TimerPill } from "./screens/CookMode";
import { Editor } from "./screens/Editor";
import { Explore } from "./screens/Explore";
import { FridgeScreen } from "./screens/Fridge";
import { Home } from "./screens/Home";
import { PostView, FriendsList, ProfileScreen } from "./screens/Profile";
import { RecipeDetail } from "./screens/RecipeDetail";
import { Scanner } from "./screens/Scanner";
import { SettingsScreen, StatsScreen } from "./screens/Settings";
import { Sheets } from "./screens/Sheets";
import { ShoppingScreen } from "./screens/Shopping";
import { Social } from "./screens/Social";
import { Week, WeekWizard } from "./screens/Week";
import { useExit } from "./motion";

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Accueil", icon: "home" },
  { id: "week", label: "Semaine", icon: "calendar" },
  { id: "fridge", label: "Frigo", icon: "fridge" },
  { id: "shopping", label: "Courses", icon: "cart" },
  { id: "social", label: "Social", icon: "users" }
];

/* Capsule de l'onglet actif : ses deux bords sont animés à des vitesses différentes.
   Celui qui part devant arrive vite, celui qui suit traîne puis rattrape : la capsule
   s'étire puis se resserre, comme une goutte, au lieu de glisser d'un bloc. */
const RAPIDE = "cubic-bezier(.3,.58,.34,1)";
const LENT = "cubic-bezier(.33,.3,.34,1)";
function placeThumb(nav: HTMLElement, thumb: HTMLElement, animate: boolean) {
  const btn = nav.querySelector<HTMLElement>(".nav-btn.on");
  if (!btn) return;
  const vertical = getComputedStyle(nav).flexDirection === "column";
  const [a, b, propA, propB] = vertical
    ? [btn.offsetTop, nav.clientHeight - (btn.offsetTop + btn.offsetHeight), "top", "bottom"]
    : [btn.offsetLeft, nav.clientWidth - (btn.offsetLeft + btn.offsetWidth), "left", "right"];
  thumb.style.setProperty(vertical ? "left" : "top", "");
  thumb.style.setProperty(vertical ? "right" : "bottom", "");
  const avant = parseFloat(thumb.style.getPropertyValue(propA));
  if (!animate || isNaN(avant) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    thumb.style.transition = "none";
    thumb.style.setProperty(propA, a + "px");
    thumb.style.setProperty(propB, b + "px");
    void thumb.offsetWidth;
    thumb.style.transition = "";
    return;
  }
  if (Math.abs(avant - a) < 1) return;
  const versLaFin = a > avant;
  thumb.style.transition = propA + " " + (versLaFin ? ".5s " + LENT : ".44s " + RAPIDE) + ", " + propB + " " + (versLaFin ? ".44s " + RAPIDE : ".5s " + LENT);
  thumb.style.setProperty(propA, a + "px");
  thumb.style.setProperty(propB, b + "px");
  thumb.classList.remove("moving");
  void thumb.offsetWidth;
  thumb.classList.add("moving");
}

function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const t = tab.value;
  const badges: Partial<Record<Tab, number>> = {
    fridge: urgentItems(fridge.value).length,
    shopping: shopping.value.filter((s) => !s.checked).length,
    social: incoming.value.length
  };
  useLayoutEffect(() => {
    if (navRef.current && thumbRef.current) placeThumb(navRef.current, thumbRef.current, !first.current);
    first.current = false;
  }, [t]);
  useEffect(() => {
    const re = () => navRef.current && thumbRef.current && placeThumb(navRef.current, thumbRef.current, false);
    addEventListener("resize", re);
    document.fonts && document.fonts.ready.then(re);
    // si la barre change de taille (rotation, police), la capsule se recale
    const ro = typeof ResizeObserver !== "undefined" && navRef.current ? new ResizeObserver(re) : null;
    if (ro && navRef.current) ro.observe(navRef.current);
    return () => {
      removeEventListener("resize", re);
      ro && ro.disconnect();
    };
  }, []);
  return (
    <nav class="nav" ref={navRef} aria-label="Navigation principale">
      <span class="thumb" ref={thumbRef} aria-hidden="true" />
      <div class="brand-side">
        <img src="/logo-wordmark.png" alt="Yummly" />
      </div>
      {NAV.map((n) => (
        <button class={"nav-btn" + (t === n.id ? " on" : "")} aria-current={t === n.id ? "page" : undefined} onClick={() => setTab(n.id)}>
          <span class="ni">
            <Icon name={n.icon} />
            {!!badges[n.id] && (
              <span class="badge" aria-label={badges[n.id] + (n.id === "fridge" ? " à consommer vite" : "")}>
                {badges[n.id]}
              </span>
            )}
          </span>
          <span class="lbl">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

function OverlayView({ o }: { o: Overlay }) {
  switch (o.kind) {
    case "explore":
      return <Explore o={o} />;
    case "recipe":
      return <RecipeDetail o={o} />;
    case "cook":
      return <CookMode o={o} />;
    case "editor":
      return <Editor o={o} />;
    case "profile":
      return <ProfileScreen id={o.id} />;
    case "friends":
      return <FriendsList id={o.id} name={o.name} />;
    case "post":
      return <PostView id={o.id} />;
    case "settings":
      return <SettingsScreen />;
    case "stats":
      return <StatsScreen />;
    case "scanner":
      return <Scanner />;
    case "weekWizard":
      return <WeekWizard />;
  }
}

/** Chaque écran superposé repart en glissant quand on le ferme. */
function OverlayHost({ o, hidden }: { o: Overlay; hidden: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useExit(ref, o.kind === "cook" ? "cook-leave" : "ov-leave", 300, (el) => el.firstElementChild);
  return (
    <div ref={ref} style={{ display: "contents" }} aria-hidden={hidden ? "true" : undefined}>
      <OverlayView o={o} />
    </div>
  );
}

function useOnline() {
  const [on, setOn] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true),
      b = () => setOn(false);
    addEventListener("online", a);
    addEventListener("offline", b);
    return () => {
      removeEventListener("online", a);
      removeEventListener("offline", b);
    };
  }, []);
  return on;
}

export function App() {
  const ov = overlays.value;
  const online = useOnline();
  // sens du glissement : vers la droite si l'onglet choisi est à droite du précédent
  const prevTab = useRef<Tab>(tab.value);
  const dirRef = useRef(0);
  if (tab.value !== prevTab.current) {
    dirRef.current = Math.sign(TABS.indexOf(tab.value) - TABS.indexOf(prevTab.current));
    prevTab.current = tab.value;
  }
  const dir = dirRef.current;
  useEffect(() => {
    document.body.classList.toggle("noscroll", ov.length > 0);
  }, [ov.length]);
  const t = tab.value;
  return (
    <div class="app">
      {!online && <div class="offline">Hors ligne · tes données restent sur l'appareil</div>}
      <main class="main" aria-hidden={ov.length > 0 ? "true" : undefined}>
        <div class={"screen-enter" + (dir ? " turning" : "")} key={t} style={{ "--slide": dir * 26 + "px" } as any}>
          {t === "home" && <Home />}
          {t === "week" && <Week />}
          {t === "fridge" && <FridgeScreen />}
          {t === "shopping" && <ShoppingScreen />}
          {t === "social" && <Social />}
        </div>
      </main>
      <Nav />
      {ov.map((o, i) => (
        // les écrans du dessous restent montés (et gardent leur défilement) sous celui du dessus
        <OverlayHost key={i + o.kind + ("id" in o ? o.id : "")} o={o} hidden={i < ov.length - 1} />
      ))}
      {!(ov.length && ov[ov.length - 1].kind === "cook") && <TimerPill />}
      <Sheets />
      <ConfirmDialog />
      <Toast />
    </div>
  );
}
export { TABS };
