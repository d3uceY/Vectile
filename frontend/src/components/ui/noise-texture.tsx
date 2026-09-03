import { uid } from "../../lib/uid";

/** An SVG fractal noise layer using `feTurbulence`, desaturation, and contrast
    controls for subtle texture overlays. Ported from MagicUI (NoiseTexture) to
    Solid + Tailwind. Renders a full-size `svg` (absolute, inset 0); layer
    content above with `z-10` when needed. */
export function NoiseTexture(props: { class?: string }) {
  const filterId = uid("noise");
  return (
    <svg
      class={`pointer-events-none absolute inset-0 z-0 h-full w-full select-none opacity-25 ${props.class ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <filter id={filterId}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency={0.4}
          numOctaves={6}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope={0.15} />
          <feFuncG type="linear" slope={0.15} />
          <feFuncB type="linear" slope={0.15} />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity={0.6} />
    </svg>
  );
}
