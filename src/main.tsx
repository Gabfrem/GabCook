import "./styles/fonts.css";
import "./styles/app.css";
import { render } from "preact";
import { App } from "./ui/App";
import { boot } from "./ui/boot";

render(<App />, document.getElementById("app")!);
void boot();
