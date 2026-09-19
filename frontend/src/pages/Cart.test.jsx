import { describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Cart from "./Cart";
import { CartProvider, useCart } from "../cart/CartContext";

// addItem changes CartProvider's state, which re-renders every child
// including this one - a guard-less call here would call addItem again
// on that very re-render, forever. useEffect + a ran-once ref keeps this
// to exactly one seed regardless of how many times CartProvider re-renders.
function Seed({ items }) {
  const { addItem } = useCart();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    items.forEach((p) => addItem(p, p.__qty || 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderCart(items = []) {
  return render(
    <MemoryRouter>
      <CartProvider>
        <Seed items={items} />
        <Cart />
      </CartProvider>
    </MemoryRouter>
  );
}

const BOWL = { id: 1, name: "Kastehelmi Bowl", category: "Tableware", price_inr: "4399.00" };
const MUG = { id: 2, name: "Moomin Mug", category: "Tableware", price_inr: "4699.00" };

beforeEach(() => {
  localStorage.clear();
});

describe("Cart", () => {
  test("shows an empty state with no items", () => {
    renderCart([]);
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
  });

  test("lists items with a subtotal in the order summary", () => {
    renderCart([BOWL, MUG]);
    expect(screen.getByText("Kastehelmi Bowl")).toBeInTheDocument();
    expect(screen.getByText("Moomin Mug")).toBeInTheDocument();
    expect(screen.getByText("₹9,098")).toBeInTheDocument(); // 4399 + 4699
  });

  test("increasing quantity updates the line subtotal and order total", async () => {
    renderCart([BOWL]);
    await userEvent.click(screen.getByLabelText("Increase quantity of Kastehelmi Bowl"));

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("₹8,798")).toHaveLength(2); // line subtotal + order subtotal, now equal
  });

  test("decrease is disabled at quantity 1 rather than silently removing the item", () => {
    renderCart([BOWL]);
    expect(screen.getByLabelText("Decrease quantity of Kastehelmi Bowl")).toBeDisabled();
    expect(screen.getByText("Kastehelmi Bowl")).toBeInTheDocument();
  });

  test("remove button takes the item out of the cart", async () => {
    renderCart([BOWL, MUG]);
    await userEvent.click(screen.getByLabelText("Remove Kastehelmi Bowl from cart"));

    expect(screen.queryByText("Kastehelmi Bowl")).not.toBeInTheDocument();
    expect(screen.getByText("Moomin Mug")).toBeInTheDocument();
  });

  test("cart becomes the empty state once the last item is removed", async () => {
    renderCart([BOWL]);
    await userEvent.click(screen.getByLabelText("Remove Kastehelmi Bowl from cart"));
    expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
  });
});
