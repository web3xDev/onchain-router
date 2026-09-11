/**
 * Official marks, served from /public/brands exactly as shipped in each brand kit.
 *
 * Hedera: brand.hedera.com logo library (white variants for dark backgrounds).
 * Arc: Circle pressroom Arc_Logos.zip (white variants).
 * The Graph: thegraph.com/brand logo and logomark packages ("Light" variants, white).
 * Neither file is edited; the guidelines forbid recolouring or redrawing the marks.
 */
// `scale` evens out the visual weight: the Hedera files carry padding inside the
// viewBox, the Arc files are cropped tight, so the same pixel height reads unequal.
const MARKS = {
  hedera: { icon: "/brands/hedera-icon.svg", logo: "/brands/hedera-logo.svg", name: "Hedera", scale: 1.1, nudge: 0 },
  arc: { icon: "/brands/arc-icon.svg", logo: "/brands/arc-logo.svg", name: "Arc", scale: 0.85, nudge: 0 },
  graph: { icon: "/brands/graph-icon.svg", logo: "/brands/graph-logo.svg", name: "The Graph", scale: 1.15, nudge: 1 },
} as const;

export type BrandId = keyof typeof MARKS;

export function Brand({
  id,
  kind = "icon",
  height = 16,
}: {
  id: BrandId;
  kind?: "icon" | "logo";
  height?: number;
}) {
  const mark = MARKS[id];
  const px = Math.round(height * mark.scale);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mark[kind]}
      alt={mark.name}
      height={px}
      style={{
        height: px,
        width: "auto",
        display: "inline-block",
        verticalAlign: "middle",
        // Optical baseline: some marks sit high in their own box.
        position: "relative",
        top: mark.nudge,
      }}
    />
  );
}
