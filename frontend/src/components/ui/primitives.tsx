import { For, type JSX } from "solid-js";
import type { ModelState } from "../../lib/types";
import { ChevronDown, CloseIcon } from "./icons";

/* ---------------- Button ---------------- */

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "quiet";
  size?: "sm" | "md";
};

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";
  const cls = `inline-flex items-center justify-center gap-2 rounded-control font-medium transition-all duration-150 ease-snappy select-none active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none ${
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-9.5 px-4 text-sm"
  } ${
    variant === "primary"
      ? "bg-leaf-deep text-white hover:bg-leaf shadow-[0_1px_2px_rgb(23_115_64/0.3)]"
      : variant === "outline"
        ? "border border-line-strong bg-paper text-ink-soft hover:border-leaf/50 hover:text-ink"
        : variant === "ghost"
          ? "text-muted hover:bg-surface hover:text-ink"
          : "text-faint hover:text-ink"
  } ${props.class ?? ""}`;
  return (
    <button
      {...props}
      class={cls}
      type={props.type ?? "button"}
      aria-pressed={props["aria-pressed"]}
    >
      {props.children}
    </button>
  );
}

/* ---------------- Kbd ---------------- */

export function Kbd(props: { children: JSX.Element; class?: string }) {
  return (
    <kbd
      class={`inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface px-1 font-mono text-[11px] leading-none text-muted ${props.class ?? ""}`}
    >
      {props.children}
    </kbd>
  );
}

/* ---------------- Chip ---------------- */

export function Chip(props: {
  children: JSX.Element;
  tone?: "neutral" | "mint" | "leaf" | "code";
  class?: string;
}) {
  const tone = props.tone ?? "neutral";
  const cls =
    tone === "mint"
      ? "bg-mint text-leaf-deep"
      : tone === "leaf"
        ? "bg-leaf text-white"
        : tone === "code"
          ? "bg-surface text-muted font-mono"
          : "bg-surface text-muted";
  return (
    <span
      class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-4 ${cls} ${props.class ?? ""}`}
    >
      {props.children}
    </span>
  );
}

/* ---------------- Select (native, accessible) ---------------- */

type SelectProps = {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange?: (e: Event & { currentTarget: HTMLSelectElement }) => void;
  "aria-label"?: string;
  class?: string;
};

export function Select(props: SelectProps) {
  return (
    <label class={`inline-flex items-center gap-2 text-[13px] text-muted ${props.class ?? ""}`}>
      {props.label && <span class="whitespace-nowrap">{props.label}</span>}
      <span class="relative inline-flex">
        <select
          value={props.value}
          aria-label={props["aria-label"]}
          onChange={(e) => props.onChange?.(e)}
          class="h-8 appearance-none rounded-control border border-line bg-paper pl-3 pr-8 text-[13px] text-ink transition-colors hover:border-line-strong focus:border-leaf"
        >
          <For each={props.options}>{(o) => <option value={o.value}>{o.label}</option>}</For>
        </select>
        <ChevronDown size={14} class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" />
      </span>
    </label>
  );
}

/* ---------------- Toggle ---------------- */

export function Toggle(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label class="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span>
        <span class="block text-sm text-ink">{props.label}</span>
        {props.description && <span class="block text-[13px] text-muted">{props.description}</span>}
      </span>
      <input
        type="checkbox"
        class="peer sr-only"
        checked={props.checked}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span class="relative h-6 w-10 shrink-0 rounded-full border border-line-strong bg-surface transition-colors duration-150 ease-snappy peer-checked:bg-leaf peer-checked:border-leaf after:absolute after:left-0.5 after:top-0.5 after:h-4.5 after:w-4.5 after:rounded-full after:bg-white after:transition-transform after:duration-150 after:ease-snappy peer-checked:after:translate-x-4" />
    </label>
  );
}

/* ---------------- StatusPill (in-process model engine) ---------------- */

const modelCopy: Record<ModelState, { label: string; dot: string; text: string }> = {
  loaded: { label: "model loaded", dot: "bg-leaf", text: "text-leaf-deep" },
  idle: { label: "model idle", dot: "bg-faint", text: "text-muted" },
  failed: { label: "model failed", dot: "bg-danger", text: "text-danger" },
};

export function StatusPill(props: { state: ModelState; name?: string }) {
  const m = () => modelCopy[props.state];
  return (
    <span
      class={`inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 ${m().text}`}
      title={props.name}
    >
      <span class="relative flex h-2 w-2">
        <span class={`h-2 w-2 rounded-full ${m().dot} ${props.state === "loaded" ? "pulse-dot" : ""}`} />
      </span>
      <span class="data">{m().label}</span>
      {props.name && <span class="data text-faint">· {props.name}</span>}
    </span>
  );
}

/* ---------------- EmptyState ---------------- */

export function EmptyState(props: {
  icon?: JSX.Element;
  title: string;
  note?: string;
  children?: JSX.Element;
}) {
  return (
    <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
      {props.icon && (
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-card border border-line bg-surface text-leaf">
          {props.icon}
        </div>
      )}
      <h3 class="text-lg font-semibold tracking-[-0.01em] text-ink">{props.title}</h3>
      {props.note && <p class="note mt-2 max-w-[34ch] text-[15.5px] leading-6 text-muted">{props.note}</p>}
      {props.children && <div class="mt-5">{props.children}</div>}
    </div>
  );
}

/* ---------------- Skeleton ---------------- */

export function Skeleton(props: { class?: string }) {
  return (
    <div
      class={`animate-pulse rounded-md bg-surface ${props.class ?? "h-4 w-full"}`}
      aria-hidden="true"
    />
  );
}

/* ---------------- View heading ---------------- */

export function ViewHeading(props: { title: string; note?: string; children?: JSX.Element }) {
  return (
    <div class="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 class="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {props.title}
        </h1>
        {props.note && <p class="note mt-1.5 text-[15.5px] text-muted">{props.note}</p>}
      </div>
      {props.children && <div class="flex items-center gap-2">{props.children}</div>}
    </div>
  );
}

/* ---------------- Toast ---------------- */

export function ToastStack(props: {
  toasts: { id: number; message: string; tone: "neutral" | "success" | "danger" }[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      <For each={props.toasts}>
        {(t) => (
          <div
            class={`pointer-events-auto flex items-start gap-3 rounded-card border bg-paper px-4 py-3 shadow-pop ${
              t.tone === "danger" ? "border-danger/40" : "border-line"
            }`}
          >
            <span
              class={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                t.tone === "success" ? "bg-leaf" : t.tone === "danger" ? "bg-danger" : "bg-faint"
              }`}
            />
            <p class="flex-1 text-[13px] leading-5 text-ink-soft">{t.message}</p>
            <button
              class="text-faint hover:text-ink"
              onClick={() => props.onDismiss(t.id)}
              aria-label="Dismiss"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
