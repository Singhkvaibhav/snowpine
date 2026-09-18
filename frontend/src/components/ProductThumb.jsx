// Placeholder visual until real product photography is sourced - a
// deterministic color per category plus the product's initial, so the
// catalog reads visually distinct without using unlicensed brand images.
const CATEGORY_COLORS = {
  "Baby Carriers": "#7a8b99",
  "Baby Feeding": "#5f8fa8",
  "Baby Bedding": "#8aa9b8",
  "Baby Clothing": "#6f7f9e",
  "Tableware": "#3f6b7a",
  "Bags": "#4a5a63",
  "Home Decor": "#7d6a58",
  "Cutlery & Kitchenware": "#5a6b5a",
  "Textiles": "#8a6f7a",
  "Kitchenware & Tools": "#a85f4a",
  "Skincare": "#7a9a7f",
};
const DEFAULT_COLOR = "#5f7480";

export default function ProductThumb({ product, style }) {
  const color = CATEGORY_COLORS[product.category] || DEFAULT_COLOR;
  const initial = product.name.trim().charAt(0).toUpperCase();
  return (
    <div className="product-thumb" style={{ background: color, ...style }} aria-hidden="true">
      {initial}
    </div>
  );
}
