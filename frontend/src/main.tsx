import { render } from "solid-js/web";
import "./index.css";
import App from "./App";

// Desktop app: no native browser context menu on the app chrome. The menu is
// kept inside editable text so copy/paste/undo still work there.
window.addEventListener("contextmenu", (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.closest("input, textarea") || t.isContentEditable)) return;
  e.preventDefault();
});

render(() => <App />, document.getElementById("root") as HTMLElement);
