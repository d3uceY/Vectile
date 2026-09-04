import { onCleanup, onMount } from "solid-js";
import { driver } from "driver.js";
import { pickFolder } from "../../lib/api";
import { useAppStore } from "../../lib/store";

const SEEN_KEY = "vectile.setup-seen";

/** One-time, three-step setup tour for a fresh (empty) library. Uses driver.js
    to walk Settings → Index → Search, each step's popover carrying the real
    action. Any close, skip, or finish marks the tour as seen so it never runs
    again. Renders nothing. */
export function SetupTour() {
  const store = useAppStore();

  onMount(() => {
    let timer = 0;
    if (localStorage.getItem(SEEN_KEY)) return;

    timer = window.setTimeout(() => {
      if (localStorage.getItem(SEEN_KEY)) return;
      if (store.status() === null) return;
      if (store.collections().length > 0) {
        localStorage.setItem(SEEN_KEY, "1"); // already has a library
        return;
      }
      start();
    }, 1000);
    onCleanup(() => window.clearTimeout(timer));
  });

  const start = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    store.setView("settings");

    const tour = driver({
      animate: !reduced,
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      allowClose: true,
      overlayColor: "#1b2226",
      overlayOpacity: 0.35,
      stagePadding: 6,
      onPopoverRender: (popover) => {
        popover.nextButton.classList.add("setup-next");
        popover.previousButton.classList.add("setup-prev");
        popover.closeButton.title = "Skip tour";
        popover.closeButton.setAttribute("aria-label", "Skip tour");
      },
      onDestroyed: () => localStorage.setItem(SEEN_KEY, "1"),
      steps: [
        {
          element: "#setup-add-folder",
          waitForElement: 1500,
          popover: {
            title: "Add a folder",
            description:
              "Point vectile at a folder of notes, books, or project files.",
            nextBtnText: "Choose a folder",
            onNextClick: async (_el, _step, opts) => {
              const dir = await pickFolder("Choose a folder to index");
              if (!dir) return; // cancelled; stay on this step
              const name = dir.split(/[\\/]/).filter(Boolean).pop() || "library";
              const ok = await store.addSource("project", name, dir);
              if (!ok) return;
              store.setView("index");
              opts.driver.moveNext();
            },
          },
        },
        {
          element: "#setup-index-all",
          waitForElement: 1500,
          popover: {
            title: "Index it",
            description:
              "Index all turns that folder into a searchable collection.",
            nextBtnText: "Index now",
            onNextClick: (_el, _step, opts) => {
              void store.startIndexAll();
              store.setView("search");
              opts.driver.moveNext();
            },
          },
        },
        {
          element: "#search-input",
          waitForElement: 1500,
          popover: {
            title: "Search your library",
            description:
              "Ask anything you half-remember. Cmd/Ctrl+K focuses this box from anywhere.",
            doneBtnText: "Done",
            onDoneClick: (_el, _step, opts) => opts.driver.destroy(),
          },
        },
      ],
    });
    tour.drive();
  };

  return null;
}
