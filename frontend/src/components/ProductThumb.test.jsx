import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductThumb from "./ProductThumb";

describe("ProductThumb", () => {
  test("shows the uppercased first letter of the product name", () => {
    render(<ProductThumb product={{ name: "kånken mini", category: "Bags" }} />);
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  test("trims leading whitespace before taking the initial", () => {
    render(<ProductThumb product={{ name: "  Bowl", category: "Tableware" }} />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  test("uses a known category's color, consistently for the same category", () => {
    const { container: a } = render(<ProductThumb product={{ name: "A", category: "Skincare" }} />);
    const { container: b } = render(<ProductThumb product={{ name: "B", category: "Skincare" }} />);
    expect(a.firstChild.style.background).toBe(b.firstChild.style.background);
    expect(a.firstChild.style.background).not.toBe("");
  });

  test("falls back to a default color for an unrecognized category", () => {
    const { container } = render(<ProductThumb product={{ name: "Mystery", category: "Not A Real Category" }} />);
    expect(container.firstChild.style.background).toBe("rgb(95, 116, 128)"); // #5f7480
  });

  test("merges any extra style overrides passed in", () => {
    const { container } = render(
      <ProductThumb product={{ name: "X", category: "Bags" }} style={{ minHeight: "320px" }} />
    );
    expect(container.firstChild.style.minHeight).toBe("320px");
  });
});
