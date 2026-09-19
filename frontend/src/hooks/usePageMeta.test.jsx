import { describe, test, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import usePageMeta from "./usePageMeta";

function Probe(props) {
  usePageMeta(props);
  return null;
}

afterEach(cleanup);

describe("usePageMeta", () => {
  test("falls back to the site default title/description when nothing is passed", () => {
    render(<Probe />);
    expect(document.title).toBe("Snowpine - Nordic goods, delivered in India");
    expect(document.querySelector('meta[name="description"]').content).toMatch(/Nordic baby gear/);
  });

  test("suffixes a page title with the site name", () => {
    render(<Probe title="Your Cart" />);
    expect(document.title).toBe("Your Cart - Snowpine");
  });

  test("uses a page-specific description when given one", () => {
    render(<Probe title="Kastehelmi Bowl" description="Finnish glassware with a dewdrop pattern." />);
    expect(document.querySelector('meta[name="description"]').content).toBe(
      "Finnish glassware with a dewdrop pattern."
    );
  });

  test("reverts to the default when a later page passes no title", () => {
    const { rerender } = render(<Probe title="Checkout" />);
    expect(document.title).toBe("Checkout - Snowpine");
    rerender(<Probe />);
    expect(document.title).toBe("Snowpine - Nordic goods, delivered in India");
  });
});
