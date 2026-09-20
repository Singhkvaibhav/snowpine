import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import WishlistButton from "./WishlistButton";
import * as AuthContext from "../auth/AuthContext";
import * as WishlistContext from "../wishlist/WishlistContext";

const product = { id: 1, name: "Kastehelmi Bowl" };

// Mirrors how every real usage renders it: inside a <Link> (the product
// card), since the button's preventDefault/stopPropagation only matters
// in that context - a bare render wouldn't catch a regression there.
function renderInCard({ onNavigate } = {}) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <Link to="/product/1" data-testid="card">
              <WishlistButton product={product} />
            </Link>
          }
        />
        <Route path="/product/1" element={<div>Product page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("WishlistButton", () => {
  test("clicking while logged out navigates to /login instead of toggling", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null });
    const toggle = vi.fn();
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({ isSaved: () => false, toggle });
    renderInCard();

    await userEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(toggle).not.toHaveBeenCalled();
  });

  test("clicking while logged in toggles without navigating the surrounding card link", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    const toggle = vi.fn();
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({ isSaved: () => false, toggle });
    renderInCard();

    await userEvent.click(screen.getByRole("button"));

    expect(toggle).toHaveBeenCalledWith(product);
    expect(screen.queryByText("Product page")).not.toBeInTheDocument();
  });

  test("reflects the saved state via aria-pressed and a filled icon", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({ isSaved: () => true, toggle: vi.fn() });
    renderInCard();

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.querySelector("svg")).toHaveAttribute("fill", "currentColor");
  });

  test("shows a text label in the showLabel variant", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({ isSaved: () => false, toggle: vi.fn() });
    render(
      <MemoryRouter>
        <WishlistButton product={product} showLabel />
      </MemoryRouter>
    );
    expect(screen.getByText("Save for later")).toBeInTheDocument();
  });
});
