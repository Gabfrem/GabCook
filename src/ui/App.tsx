import { useEffect, useState } from "preact/hooks";
import { urgentItems } from "../core/fridge";
import { incoming } from "../services/social";
import { fridge, shopping } from "../state/store";
import { overlays, setTab, tab, TABS, type Overlay, type Tab } from "../state/ui";
import { ConfirmDialog, Toast } from "./components/common";
import { Icon } from "./components/Icon";
import { CookMode } from "./screens/CookMode";
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

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Accueil", icon: "home" },
  { id: "week", label: "Semaine", icon: "calendar" },
  { id: "fridge", label: "Frigo", icon: "fridge" },
  { id: "shopping", label: "Courses", icon: "cart" },
  { id: "social", label: "Social", icon: "users" }
];

function Nav() {
  const badges: Partial<Record<Tab, number>> = {
    fridge: urgentItems(fridge.value).length,
    shopping: shopping.value.filter((s) => !s.checked).length,
    social: incoming.value.length
  };
  return (
    <nav class="nav" aria-label="Navigation principale">
      <div class="brand-side">
        <img src="/logo-wordmark.png" alt="Yummly" />
      </div>
      {NAV.map((n) => (
        <button class={"nav-btn" + (tab.value === n.id ? " on" : "")} aria-current={tab.value === n.id ? "page" : undefined} onClick={() => setTab(n.id)}>
          <Icon name={n.icon} />
          <span>{n.label}</span>
          {!!badges[n.id] && (
            <span class="badge" aria-label={badges[n.id] + (n.id === "fridge" ? " à consommer vite" : "")}>
              {badges[n.id]}
            </span>
          )}
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
  useEffect(() => {
    document.body.classList.toggle("noscroll", ov.length > 0);
  }, [ov.length]);
  const t = tab.value;
  return (
    <div class="app">
      {!online && <div class="offline">Hors ligne · tes données restent sur l'appareil</div>}
      <main class="main" aria-hidden={ov.length > 0 ? "true" : undefined}>
        <div class="screen-enter" key={t}>
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
        <div key={i + o.kind} style={{ display: "contents" }} aria-hidden={i < ov.length - 1 ? "true" : undefined}>
          <OverlayView o={o} />
        </div>
      ))}
      <Sheets />
      <ConfirmDialog />
      <Toast />
    </div>
  );
}
export { TABS };
