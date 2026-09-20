import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MyWishlist from "./MyWishlist";
import { CartProvider, useCart } from "../cart/CartContext";
import * as AuthContext from "../auth/AuthContext";
import * as WishlistContext from "../wishlist/WishlistContext";

const PRODUCT = {
  id: 1,
  name: "Kastehelmi Bowl",
  origin_country: "Finland",
  category: "Tableware",
  price_inr: "3399.00",
  stock_quantity: 5,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/account/wishlist"]}>
      <CartProvider>
        <Routes>
          <Route path="/account/wishlist" element={<MyWishlist />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </CartProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("MyWishlist", () => {
  test("redirects to /login when not signed in", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null, loading: false });
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({ items: [], loading: false, isSaved: () => false, toggle: vi.fn() });
    renderPage();
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  test("shows an empty state with nothing saved", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1, name: "Priya" }, loading: false });
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({ items: [], loading: false, isSaved: () => false, toggle: vi.fn() });
    renderPage();
    expect(await screen.findByText("Nothing saved yet.")).toBeInTheDocument();
  });

  test("lists saved products", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1, name: "Priya" }, loading: false });
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({
      items: [PRODUCT],
      loading: false,
      isSaved: () => true,
      toggle: vi.fn(),
    });
    renderPage();
    expect(await screen.findByText("Kastehelmi Bowl")).toBeInTheDocument();
    expect(screen.getByText("₹3,399")).toBeInTheDocument();
  });

  test("Add to cart from the wishlist adds the item without navigating away", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1, name: "Priya" }, loading: false });
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({
      items: [PRODUCT],
      loading: false,
      isSaved: () => true,
      toggle: vi.fn(),
    });
    renderPage();
    await screen.findByText("Kastehelmi Bowl");

    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(await screen.findByText("Kastehelmi Bowl")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("snowpine_cart") || "[]");
    expect(stored.find((i) => i.productId === 1)).toBeTruthy();
  });

  test("out-of-stock saved product shows a disabled button", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1, name: "Priya" }, loading: false });
    vi.spyOn(WishlistContext, "useWishlist").mockReturnValue({
      items: [{ ...PRODUCT, stock_quantity: 0 }],
      loading: false,
      isSaved: () => true,
      toggle: vi.fn(),
    });
    renderPage();
    expect(await screen.findByRole("button", { name: "Out of stock" })).toBeDisabled();
  });
});
