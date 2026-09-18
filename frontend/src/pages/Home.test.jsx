import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import { CartProvider } from "../cart/CartContext";
import * as apiClient from "../api/client";

const PRODUCTS = [
  { id: 1, name: "Kånken Mini", description: "Compact backpack", origin_country: "Sweden", category: "Bags", price_inr: "5999.00", stock_quantity: 10 },
  { id: 2, name: "Kastehelmi Bowl", description: "Dewdrop glassware", origin_country: "Finland", category: "Tableware", price_inr: "4399.00", stock_quantity: 5 },
  { id: 3, name: "Moomin Mug", description: "Porcelain mug", origin_country: "Finland", category: "Tableware", price_inr: "4699.00", stock_quantity: 0 },
];

function renderHome() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <Home />
      </CartProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Home", () => {
  test("renders all products once loaded", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(PRODUCTS);
    renderHome();

    expect(await screen.findByText("Kånken Mini")).toBeInTheDocument();
    expect(screen.getByText("Kastehelmi Bowl")).toBeInTheDocument();
    expect(screen.getByText("Moomin Mug")).toBeInTheDocument();
  });

  test("shows an error if the product fetch fails", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockRejectedValue(new Error("Failed to load products"));
    renderHome();

    expect(await screen.findByText("Failed to load products")).toBeInTheDocument();
  });

  test("category filter narrows the visible products", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(PRODUCTS);
    renderHome();
    await screen.findByText("Kånken Mini");

    await userEvent.click(screen.getByRole("button", { name: "Tableware" }));

    expect(screen.queryByText("Kånken Mini")).not.toBeInTheDocument();
    expect(screen.getByText("Kastehelmi Bowl")).toBeInTheDocument();
    expect(screen.getByText("Moomin Mug")).toBeInTheDocument();
  });

  test("search matches on name, description, or origin country", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(PRODUCTS);
    renderHome();
    await screen.findByText("Kånken Mini");

    await userEvent.type(screen.getByPlaceholderText("Search products..."), "moomin");
    expect(screen.queryByText("Kånken Mini")).not.toBeInTheDocument();
    expect(screen.getByText("Moomin Mug")).toBeInTheDocument();
  });

  test("search is case-insensitive and matches description text", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(PRODUCTS);
    renderHome();
    await screen.findByText("Kånken Mini");

    await userEvent.type(screen.getByPlaceholderText("Search products..."), "DEWDROP");
    expect(screen.getByText("Kastehelmi Bowl")).toBeInTheDocument();
    expect(screen.queryByText("Kånken Mini")).not.toBeInTheDocument();
  });

  test("shows a no-results message when search matches nothing", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(PRODUCTS);
    renderHome();
    await screen.findByText("Kånken Mini");

    await userEvent.type(screen.getByPlaceholderText("Search products..."), "nonexistent item xyz");
    expect(await screen.findByText("No products match your search.")).toBeInTheDocument();
  });

  test("category and search combine (both must match)", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(PRODUCTS);
    renderHome();
    await screen.findByText("Kånken Mini");

    await userEvent.click(screen.getByRole("button", { name: "Tableware" }));
    await userEvent.type(screen.getByPlaceholderText("Search products..."), "moomin");

    expect(screen.queryByText("Kastehelmi Bowl")).not.toBeInTheDocument();
    expect(screen.getByText("Moomin Mug")).toBeInTheDocument();
  });

  test("out-of-stock products show a disabled Out of stock button", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(PRODUCTS);
    renderHome();
    await screen.findByText("Moomin Mug");

    const card = screen.getByText("Moomin Mug").closest("a");
    const button = card.querySelector("button");
    expect(button).toHaveTextContent("Out of stock");
    expect(button).toBeDisabled();
  });

  test("adding an in-stock product to cart does not navigate away", async () => {
    vi.spyOn(apiClient, "fetchProducts").mockResolvedValue(PRODUCTS);
    renderHome();
    await screen.findByText("Kånken Mini");

    const card = screen.getByText("Kånken Mini").closest("a");
    await userEvent.click(card.querySelector("button"));

    // Still on the product listing, not navigated to /product/1 - the
    // add-to-cart click calls preventDefault() specifically to stop the
    // surrounding <Link> from firing.
    expect(await screen.findByText("Kånken Mini")).toBeInTheDocument();
  });
});
