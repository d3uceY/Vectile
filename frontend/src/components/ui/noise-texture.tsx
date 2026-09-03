let seq = 0;
const uid = (prefix: string) => `${prefix}-${++seq}-${Math.random().toString(36).slice(2, 7)}`;

type NoiseTextureProps = {
  class?: string;
  /** `baseFrequency` for `feTurbulence`; higher values yield finer-grained noise. */
  frequency?: number;
  /** `numOctaves` for `feTurbulence`; more octaves add detail at smaller scales. */
  octaves?: number;
  /** Linear slope on each channel after desaturation; adjusts contrast of the noise. */
  slope?: number;
  /** Opacity of the filled noise layer (`rect`). */
  noiseOpacity?: number;
};

/** An SVG fractal noise layer using `feTurbulence`, desaturation, and contrast
    controls for subtle texture overlays. Ported from MagicUI (NoiseTexture) to
    Solid + Tailwind. Renders a full-size `svg` (absolute, inset 0); layer
    content above with `z-10` when needed. */
export function NoiseTexture(props: NoiseTextureProps) {
  const filterId = uid("noise");
  const { frequency = 0.4, octaves = 6, slope = 0.15, noiseOpacity = 0.6 } = props;
  return (
    <svg
      class={`pointer-events-none absolute inset-0 z-0 h-full w-full select-none opacity-50 ${props.class ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <filter id={filterId}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency={frequency}
          numOctaves={octaves}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope={slope} />
          <feFuncG type="linear" slope={slope} />
          <feFuncB type="linear" slope={slope} />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity={noiseOpacity} />
    </svg>
  );
}
