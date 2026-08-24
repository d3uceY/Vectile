import { createSignal, onMount } from "solid-js";
import { Events, WML } from "@wailsio/runtime";
import { GreetService } from "../bindings/changeme";

// Show the actual Wails version this project was generated against.
const wailsVersion = "v3.0.0-beta.6";

function App() {
  const [name, setName] = createSignal<string>("");
  const [time, setTime] = createSignal<string>("Listening for Time event...");

  let titleNameRef: HTMLSpanElement | undefined;
  let toastRef: HTMLDivElement | undefined;
  let resultRef: HTMLSpanElement | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  // Crossfade the framework word in the heading ("Wails + Solid") to the name
  // the user entered ("Wails + <name>"): the old word fades out while the new
  // one fades in over the same spot.
  const swapTitleName = (name: string) => {
    const titleNameElement = titleNameRef;
    if (!titleNameElement) {
      return;
    }
    const current = titleNameElement.querySelector<HTMLSpanElement>(
      ".title-name-text:not(.is-outgoing)",
    );
    if (!current || current.textContent === name) {
      return;
    }
    const incoming = document.createElement("span");
    incoming.className = "title-name-text is-entering";
    incoming.textContent = name;
    current.classList.add("is-outgoing");
    titleNameElement.appendChild(incoming);
    // Force a reflow so the transitions run from the starting state.
    void incoming.offsetWidth;
    incoming.classList.remove("is-entering");
    current.classList.add("is-leaving");
    current.addEventListener("transitionend", () => current.remove(), { once: true });
  };

  // Pop the toast with the message Go returned, then auto-dismiss it.
  const showToast = (message: string) => {
    if (resultRef) {
      resultRef.innerText = message;
    }
    if (toastRef) {
      toastRef.classList.add("is-visible");
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastRef) {
        toastRef.classList.remove("is-visible");
      }
    }, 4000);
  };

  const doGreet = () => {
    const n = name() || "anonymous";
    swapTitleName(n);
    GreetService.Greet(n).then(showToast).catch(console.error);
  };

  onMount(() => {
    Events.On("time", (timeValue: any) => {
      // On a narrow screen the full RFC1123 stamp is too wide for the footer, so
      // show just the clock time there (matching the CSS breakpoint).
      const full = timeValue.data;
      const compact = (full.match(/\d{1,2}:\d{2}:\d{2}/) || [full])[0];
      setTime(window.matchMedia("(max-width: 640px)").matches ? compact : full);
    });
    // Reload WML so it picks up the wml tags
    WML.Reload();
  });

  return (
    <>
      <main class="container">
        <header class="brand">
          <a class="brand-mark" data-wml-openURL="https://v3.wails.io" aria-label="Wails website">
            <img src="/wails.png" class="brand-logo" alt="Wails logo" />
          </a>
          <a class="brand-badge" data-wml-openURL="https://www.solidjs.com" aria-label="SolidJS">
            <img src="/solid.svg" alt="SolidJS logo" />
          </a>
        </header>

        <h1 class="title">
          <span class="title-accent">Wails +</span>{" "}
          <span class="title-name" ref={titleNameRef}>
            <span class="title-name-text">Solid</span>
          </span>
        </h1>
        <p class="subtitle">Build beautiful cross-platform apps with Go and Solid.</p>

        <div class="greet">
          <div class="input-box">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input aria-label="input" class="input" value={name()} onInput={(e) => setName(e.currentTarget.value)} type="text" placeholder="Your name" autocomplete="off" />
            <button aria-label="greet-btn" class="btn" onClick={doGreet}>Greet
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>
      </main>

      <hr class="footer-divider" />
      <footer class="footer">
        <span class="footer-version"><span>{wailsVersion}</span></span>
        <span class="footer-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>{time()}</span>
        </span>
        <a class="footer-docs" data-wml-openURL="https://v3.wails.io" aria-label="Wails documentation">Docs
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
        </a>
      </footer>

      <div class="toast" ref={toastRef} role="status" aria-live="polite">
        <span class="toast-label">From Go</span>
        <span aria-label="result" class="toast-msg" ref={resultRef}></span>
      </div>
    </>
  );
}

export default App;

