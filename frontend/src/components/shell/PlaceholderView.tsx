import { ViewHeading, EmptyState } from "../ui/primitives";
import { GridPattern } from "../ui/patterns";

/** Honest stand-ins for surfaces that land with the backend slice. */
export function PlaceholderView(props: {
  view: string;
  title: string;
  note: string;
}) {
  return (
    <div class="relative flex h-full flex-col">
      <div class="pointer-events-none absolute inset-0 text-leaf/[0.07]">
        <GridPattern width={36} height={36} />
      </div>
      <div class="relative">
        <ViewHeading title={props.title} />
      </div>
      <div class="relative flex flex-1 items-center justify-center">
        <div class="sheet w-full max-w-[35rem] p-8">
          <EmptyState
            icon={<span class="data">{props.view.slice(0, 1).toUpperCase()}</span>}
            title={props.title}
            note={props.note}
          />
        </div>
      </div>
    </div>
  );
}
