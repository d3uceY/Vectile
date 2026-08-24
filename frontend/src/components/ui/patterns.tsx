let seq = 0;
const uid = (prefix: string) => `${prefix}-${++seq}-${Math.random().toString(36).slice(2, 7)}`;

type DotPatternProps = {
  class?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  glow?: boolean;
};

/** A fine dot grid — the "graph paper" ground. Ported from MagicUI
    (DotPattern) to Solid + Tailwind. Color follows `text-*`. */
export function DotPattern(props: DotPatternProps) {
  const id = uid("dots");
  const glowId = uid("dots-glow");
  const { width = 16, height = 16, x = 0, y = 0, cx = 1, cy = 1, cr = 1, glow = false } = props;
  return (
    <svg
      class={`pointer-events-none absolute inset-0 h-full w-full ${props.class ?? ""}`}
      aria-hidden="true"
    >
      <defs>
        {glow && (
          <radialGradient id={glowId}>
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.55" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
          </radialGradient>
        )}
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${x} ${y})`}
        >
          <circle cx={cx} cy={cy} r={cr} fill={glow ? `url(#${glowId})` : "currentColor"} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

type GridPatternProps = {
  class?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: string;
  squares?: boolean;
};

/** A square grid — the "blueprint" surface. Ported from MagicUI
    (GridPattern) to Solid + Tailwind. Color follows `text-*`. */
export function GridPattern(props: GridPatternProps) {
  const id = uid("grid");
  const {
    width = 40,
    height = 40,
    x = -1,
    y = -1,
    strokeDasharray = "0",
    squares = false,
  } = props;
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
          x={x}
          y={y}
        >
          <path
            d={`M ${width / 2} 0 V ${height} M 0 ${height / 2} H ${width}`}
            stroke="currentColor"
            stroke-width={0.5}
            stroke-dasharray={strokeDasharray}
            fill="none"
          />
          {squares && (
            <rect x={1} y={1} width={width - 2} height={height - 2} fill="none" stroke="currentColor" stroke-width={0.5} />
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
