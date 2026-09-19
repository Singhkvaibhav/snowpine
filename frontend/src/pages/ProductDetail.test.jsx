import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProductDetail from "./ProductDetail";
import { CartProvider } from "../cart/CartContext";
import * as apiClient from "../api/client";

const PRODUCT = {
  id: 1,
  name: "Liewood Wooden Pacifier Clip",
  description: "Beechwood and silicone pacifier clip.",
  origin_country: "Denmark",
  category: "Baby Feeding",
  price_inr: "2999.00",
  stock_quantity: 8,
};

const RELATED = [
  { id: 2, name: "Elodie Details Pacifier Clip", origin_country: "Sweden", category: "Baby Feeding", price_inr: "2999.00", stock_quantity: 10 },
  { id: 3, name: "Unrelated Bag", origin_country: "Sweden", category: "Bags", price_inr: "5999.00", stock_quantity: 10 },
];

function renderPage(id = "1") {
  return render(
    <MemoryRouter initialEntries={[`/product/${id}`]}>
      <CartProvider>
        <Routes>
          <Route path="/product/:id" element={<ProductDetail />} />
        </Routes>
      </CartProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ProductDetail", () => {
  test("renders product details with a breadcrumb", async () => {
    vi.spyOn(apiClient, "fetchProduct").mockResolvedValue(PRODUCT);
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(RELATED);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Liewood Wooden Pacifier Clip" })).toBeInTheDocument();
    expect(screen.getByText("₹2,999")).toBeInTheDocument();
    expect(screen.getByText("Shop")).toBeInTheDocument();
    expect(screen.getAllByText("Baby Feeding").length).toBeGreaterThan(0);
  });

  test("shows only same-category products as related, excluding itself", async () => {
    vi.spyOn(apiClient, "fetchProduct").mockResolvedValue(PRODUCT);
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(RELATED);
    renderPage();

    await screen.findByText("You may also like");
    expect(screen.getByText("Elodie Details Pacifier Clip")).toBeInTheDocument();
    expect(screen.queryByText("Unrelated Bag")).not.toBeInTheDocument();
  });

  test("quantity stepper increases and decreases within stock bounds", async () => {
    vi.spyOn(apiClient, "fetchProduct").mockResolvedValue(PRODUCT);
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue([]);
    renderPage();
    await screen.findByRole("heading", { name: "Liewood Wooden Pacifier Clip" });

    expect(screen.getByText("1")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Increase quantity"));
    expect(screen.getByText("2")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Decrease quantity"));
    await userEvent.click(screen.getByLabelText("Decrease quantity"));
    expect(screen.getByLabelText("Decrease quantity")).toBeDisabled();
  });

  test("adding to cart uses the selected quantity, not always 1", async () => {
    vi.spyOn(apiClient, "fetchProduct").mockResolvedValue(PRODUCT);
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue([]);
    renderPage();
    await screen.findByRole("heading", { name: "Liewood Wooden Pacifier Clip" });

    await userEvent.click(screen.getByLabelText("Increase quantity"));
    await userEvent.click(screen.getByLabelText("Increase quantity"));
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(await screen.findByText("Added ✓")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("snowpine_cart") || "[]");
    expect(stored.find((i) => i.productId === 1)?.quantity).toBe(3);
  });

  test("hides the quantity stepper and shows Out of stock for a sold-out product", async () => {
    vi.spyOn(apiClient, "fetchProduct").mockResolvedValue({ ...PRODUCT, stock_quantity: 0 });
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("button", { name: "Out of stock" })).toBeDisabled();
    expect(screen.getAllByText("Out of stock").length).toBeGreaterThan(0); // stock badge + button
    expect(screen.queryByLabelText("Increase quantity")).not.toBeInTheDocument();
  });

  test("shows an error message when the product fetch fails", async () => {
    vi.spyOn(apiClient, "fetchProduct").mockRejectedValue(new Error("Failed to load product"));
    renderPage();
    expect(await screen.findByText("Failed to load product")).toBeInTheDocument();
  });
});
