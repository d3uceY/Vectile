import { render } from "solid-js/web";
import "./index.css";
import App from "./App";

window.addEventListener("contextmenu", (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.closest("input, textarea") || t.isContentEditable)) return;
  e.preventDefault();
});

render(() => <App />, document.getElementById("root") as HTMLElement);
