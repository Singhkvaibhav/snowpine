import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductThumb from "./ProductThumb";

describe("ProductThumb", () => {
  test("shows the uppercased first letter of the product name", () => {
    render(<ProductThumb product={{ name: "kånken mini" }} />);
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  test("trims leading whitespace before taking the initial", () => {
    render(<ProductThumb product={{ name: "  Bowl" }} />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  // Colored per product (hashed from the name), not per category - a
  // catalog dominated by a few categories would otherwise render as a
  // wall of near-identical color. Same name must still be deterministic
  // (same product always looks the same across a reload).
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
