import { createSignal, For, Show } from "solid-js";
import type { SearchResult } from "../../lib/types";
import { ChevronDown } from "../ui/icons";
import { Chip } from "../ui/primitives";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wrap query terms in a highlighter-yellow mark. */
function Highlighted(props: { text: string; terms: string[] }) {
  const parts = () => {
    if (!props.terms.length) return [{ text: props.text, hit: false }];
    const re = new RegExp(`(${props.terms.map(escapeRe).join("|")})`, "ig");
    // split() puts matched terms at odd indices but also injects empty
    // strings (before the first match, after the last, between adjacent
    // matches). Compute the hit flag from the original index FIRST, then
    // drop the empties — otherwise filtering first shifts every index by
    // one and the highlight lands on the wrong text.
    return props.text
      .split(re)
      .map((p, i) => ({ text: p, hit: i % 2 === 1 }))
      .filter((p) => p.text.length > 0);
  };
  return (
    <>
      <For each={parts()}>
        {(p) =>
          p.hit ? (
            <mark class="rounded-sm bg-highlighter px-px text-ink">{p.text}</mark>
          ) : (
            <>{p.text}</>
          )
        }
      </For>
    </>
  );
}

function metaLine(r: SearchResult): string[] {
  const out: string[] = [];
  const m = r.metadata;
  if (typeof m.sender === "string") out.push(`from ${m.sender}`);
  if (typeof m.author === "string") out.push(m.author as string);
  if (Array.isArray(m.authors)) out.push((m.authors as string[]).join(", "));
  if (typeof m.page === "number") out.push(`p. ${m.page}`);
  if (Array.isArray(m.tags)) out.push((m.tags as string[]).map((t) => `#${t}`).join(" "));
  return out;
}

export function ResultCard(props: { result: SearchResult; terms: string[] }) {
  const [open, setOpen] = createSignal(false);
  const r = () => props.result;
  const meta = () => metaLine(r());

  return (
    <article
      class={`sheet group cursor-pointer px-5 py-4 transition-all duration-150 ease-snappy hover:border-leaf/40 hover:shadow-card ${
        open() ? "border-leaf/40 shadow-card" : ""
      }`}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
      role="button"
      tabindex={0}
      aria-expanded={open()}
      aria-label={`${r().title} — expand to read the full passage`}
    >
      <div class="flex items-start justify-between gap-4">
        <h3 class="title text-[15px] leading-6 tracking-[-0.005em] text-ink">
          <Highlighted text={r().title} terms={props.terms} />
        </h3>
        <span class="data mt-1 shrink-0 text-leaf-deep">{Math.round(r().score * 100)}%</span>
      </div>

      <p class="read mt-1.5 line-clamp-3 text-[14.5px] leading-[1.6] text-muted">
        <Highlighted text={r().content} terms={props.terms} />
      </p>

      <Show when={open()}>
        <div class="mt-3 rounded-[10px] border border-line bg-surface/60 p-4">
          <p class="read max-h-48 overflow-y-auto whitespace-pre-wrap text-[14.5px] leading-[1.65] text-ink-soft">
            {r().content}
          </p>
          <Show when={meta().length > 0}>
            <p class="data mt-3 text-faint">{meta().join(" · ")}</p>
          </Show>
        </div>
      </Show>

      <div class="mt-3 flex items-center gap-2 overflow-hidden">
        <Chip tone="mint">{r().collection}</Chip>
        <span class="data shrink-0 text-faint">{r().sourceType}</span>
        <span class="mx-0.5 h-3 w-px shrink-0 bg-line-strong" aria-hidden="true" />
        <span class="data truncate text-faint">{r().sourcePath}</span>
        <ChevronDown
          size={14}
          class={`ml-auto shrink-0 text-faint transition-transform duration-150 ease-snappy ${
            open() ? "rotate-180" : ""
          }`}
        />
      </div>
    </article>
  );
}
