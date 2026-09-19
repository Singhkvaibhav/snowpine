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

// One simple line-icon per category (built only from primitive shapes -
// circle/rect/line/ellipse/a single well-known arc or teardrop path - not
// hand-tuned bezier curves, so there's no risk of a malformed path
// rendering as a blob). Reads as "this is roughly what kind of thing this
// is" at a glance, which a bare initial letter never could.
function BabyCarrierIcon() {
  return (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M6 19a6 6 0 0 1 12 0" />
    </>
  );
}

function FeedingIcon() {
  return (
    <>
      <rect x="9" y="9" width="6" height="11" rx="2" />
      <rect x="10" y="4.5" width="4" height="4.5" rx="1" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </>
  );
}

function BeddingIcon() {
  return (
    <>
      <rect x="4" y="10" width="16" height="9" rx="2" />
      <line x1="4" y1="14.5" x2="20" y2="14.5" />
    </>
  );
}

function ClothingIcon() {
  return (
    <>
      <circle cx="12" cy="6.5" r="2" />
      <rect x="8.5" y="8.5" width="7" height="11" rx="3" />
      <rect x="4.5" y="8.5" width="4" height="6" rx="2" />
      <rect x="15.5" y="8.5" width="4" height="6" rx="2" />
    </>
  );
}

function BagIcon() {
  return (
    <>
      <path d="M9 8a3 3 0 0 1 6 0" />
      <path d="M6 8 L18 8 L17 20 L7 20 Z" />
    </>
  );
}

function DecorIcon() {
  return (
    <>
      <rect x="10.5" y="10" width="3" height="9" rx="1" />
      <circle cx="12" cy="6.5" r="2" />
    </>
  );
}

function KitchenIcon() {
  return (
    <>
      <line x1="7" y1="4" x2="7" y2="20" />
      <line x1="5" y1="4" x2="5" y2="9" />
      <line x1="9" y1="4" x2="9" y2="9" />
      <ellipse cx="17" cy="6.5" rx="2" ry="3" />
      <line x1="17" y1="9.5" x2="17" y2="20" />
    </>
  );
}

function TextileIcon() {
  return (
    <>
      <rect x="5" y="5" width="10" height="10" rx="1" />
      <rect x="9" y="9" width="10" height="10" rx="1" />
    </>
  );
}

function TablewareIcon() {
  return (
    <>
      <rect x="5" y="8" width="10" height="10" rx="2" />
      <path d="M15 11a3 3 0 0 1 0 6" />
    </>
  );
}

function SkincareIcon() {
  return <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />;
}

// Fallback for any category not explicitly mapped (a plain gift box) -
// protects a future new category from silently rendering no icon at all.
function GiftIcon() {
  return (
    <>
      <rect x="4" y="9" width="16" height="10" rx="1" />
      <line x1="4" y1="13" x2="20" y2="13" />
      <line x1="12" y1="9" x2="12" y2="19" />
    </>
  );
}

const CATEGORY_ICONS = {
  "Baby Carriers": BabyCarrierIcon,
  "Baby Feeding": FeedingIcon,
  "Baby Bedding": BeddingIcon,
  "Baby Clothing": ClothingIcon,
  Bags: BagIcon,
  "Home Decor": DecorIcon,
  "Kitchenware & Tools": KitchenIcon,
  Textiles: TextileIcon,
  Tableware: TablewareIcon,
  Skincare: SkincareIcon,
};

export default function ProductThumb({ product, style }) {
  const color = PALETTE[hashString(product.name) % PALETTE.length];
  const Icon = CATEGORY_ICONS[product.category] || GiftIcon;
  return (
    <div className="product-thumb" style={{ background: color, ...style }} aria-hidden="true">
      <svg
        className="product-thumb-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Icon />
      </svg>
    </div>
  );
}
