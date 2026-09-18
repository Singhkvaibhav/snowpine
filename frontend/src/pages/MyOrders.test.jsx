import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MyOrders from "./MyOrders";
import * as AuthContext from "../auth/AuthContext";
import * as apiClient from "../api/client";

function renderMyOrders() {
  return render(
    <MemoryRouter initialEntries={["/account/orders"]}>
      <Routes>
        <Route path="/account/orders" element={<MyOrders />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("MyOrders", () => {
  test("shows a loading state while auth is still resolving", () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null, loading: true });
    renderMyOrders();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("redirects to /login when not signed in", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null, loading: false });
    renderMyOrders();
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  test("shows an empty state with no orders", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      customer: { id: 1, name: "Priya" },
      loading: false,
    });
    vi.spyOn(apiClient, "fetchMyOrders").mockResolvedValue([]);
    renderMyOrders();

    expect(await screen.findByText("You haven't placed any orders yet.")).toBeInTheDocument();
  });

  test("renders the customer's orders with status labels and totals", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      customer: { id: 1, name: "Priya" },
      loading: false,
    });
    vi.spyOn(apiClient, "fetchMyOrders").mockResolvedValue([
      { id: 7, created_at: "2026-01-15T00:00:00Z", status: "shipped", total_inr: "4399.00" },
      { id: 8, created_at: "2026-01-16T00:00:00Z", status: "pending", total_inr: "1999.00" },
    ]);
    renderMyOrders();

    expect(await screen.findByText("#7")).toBeInTheDocument();
    expect(screen.getByText("Shipped")).toBeInTheDocument();
    expect(screen.getByText("#8")).toBeInTheDocument();
    expect(screen.getByText("Pending payment")).toBeInTheDocument();
    expect(screen.getByText("₹4,399")).toBeInTheDocument();
  });

  test("shows an error if the orders fetch fails", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      customer: { id: 1, name: "Priya" },
      loading: false,
    });
    vi.spyOn(apiClient, "fetchMyOrders").mockRejectedValue(new Error("Failed to load your orders"));
    renderMyOrders();

    expect(await screen.findByText("Failed to load your orders")).toBeInTheDocument();
  });
});
