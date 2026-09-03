import { uid } from "../../lib/uid";

type GridPatternProps = {
  class?: string;
  width?: number;
  height?: number;
};

/** A square grid: the "blueprint" surface. Ported from MagicUI
    (GridPattern) to Solid + Tailwind. Color follows `text-*`. */
export function GridPattern(props: GridPatternProps) {
  const id = uid("grid");
  const { width = 40, height = 40 } = props;
  return (
    <svg
      class={`pointer-events-none absolute inset-0 h-full w-full ${props.class ?? ""}`}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={-1}
          y={-1}
        >
          <path
            d={`M ${width / 2} 0 V ${height} M 0 ${height / 2} H ${width}`}
            stroke="currentColor"
            stroke-width={0.5}
            fill="none"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
