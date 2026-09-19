// Placeholder visual until real product photography is sourced. Colored
// per PRODUCT (hashed from the name), not per category - a catalog where
// most items sit in a handful of categories (Tableware, Baby Feeding)
// would otherwise render as a wall of near-identical color if every item
// in a category shared one swatch. Deliberately varied across families
// (blue/green/red/purple/yellow), not just shades of one hue, so the grid
// actually reads as a catalog rather than a monotone block.
const PALETTE = [
  "#2f6f8f", // ice blue
  "#3f6b52", // forest
  "#8a5a3c", // terracotta
  "#5c5470", // plum-slate
  "#7a8b52", // sage
  "#a8763e", // ochre
  "#4a5a63", // charcoal-blue
  "#8f4a4a", // brick
  "#3f7a7a", // teal
  "#6b5a8a", // muted violet
  "#5a7a4a", // olive
  "#8a6a4a", // walnut
];

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function ProductThumb({ product, style }) {
  const color = PALETTE[hashString(product.name) % PALETTE.length];
  const initial = product.name.trim().charAt(0).toUpperCase();
  return (
    <div className="product-thumb" style={{ background: color, ...style }} aria-hidden="true">
      {initial}
    </div>
  );
}
