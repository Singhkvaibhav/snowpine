import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import ProductThumb from "./ProductThumb";

describe("ProductThumb", () => {
  test("renders an icon appropriate to the product's category", () => {
    const { container } = render(<ProductThumb product={{ name: "Kastehelmi Bowl", category: "Tableware" }} />);
    const svg = container.querySelector("svg.product-thumb-icon");
    expect(svg).toBeInTheDocument();
    // Tableware's icon is a rect (mug body) + a handle arc path - not the
    // shapes any other category's icon uses.
    expect(svg.querySelector("rect")).toBeInTheDocument();
    expect(svg.querySelector("path")).toBeInTheDocument();
  });

  test("different categories render structurally different icons", () => {
    const { container: tableware } = render(
      <ProductThumb product={{ name: "A", category: "Tableware" }} />
    );
    const { container: skincare } = render(<ProductThumb product={{ name: "A", category: "Skincare" }} />);
    expect(tableware.querySelector("svg").innerHTML).not.toBe(skincare.querySelector("svg").innerHTML);
  });

  test("falls back to a generic icon for an unrecognized or missing category", () => {
    const { container } = render(<ProductThumb product={{ name: "Mystery Item", category: "Nonexistent" }} />);
    // The gift-box fallback is built from a rect + two crossing lines.
    expect(container.querySelector("svg rect")).toBeInTheDocument();
    expect(container.querySelectorAll("svg line")).toHaveLength(2);
  });

  test("is deterministic - the same product name always gets the same color", () => {
    const { container: a } = render(<ProductThumb product={{ name: "Kastehelmi Bowl" }} />);
    const { container: b } = render(<ProductThumb product={{ name: "Kastehelmi Bowl" }} />);
    expect(a.firstChild.style.background).toBe(b.firstChild.style.background);
    expect(a.firstChild.style.background).not.toBe("");
  });

  test("varies color across different product names, not one flat color for everything", () => {
    const names = ["Kastehelmi Bowl", "Kånken Mini", "Fazer Blue", "Moomin Mug", "Fiskars Scissors", "Lumene Serum"];
    const colors = new Set(
      names.map((name) => render(<ProductThumb product={{ name }} />).container.firstChild.style.background)
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  test("merges any extra style overrides passed in", () => {
    const { container } = render(<ProductThumb product={{ name: "X" }} style={{ minHeight: "320px" }} />);
    expect(container.firstChild.style.minHeight).toBe("320px");
  });
});
