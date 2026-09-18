import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "./CartContext";

const product = (overrides = {}) => ({ id: 1, name: "Kånken Mini", price_inr: "5999.00", ...overrides });

beforeEach(() => {
  localStorage.clear();
});

function renderCart() {
  return renderHook(() => useCart(), { wrapper: CartProvider });
}

describe("CartContext", () => {
  test("starts empty", () => {
    const { result } = renderCart();
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });

  test("addItem adds a new line item and coerces price_inr to a number", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(product()));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ productId: 1, name: "Kånken Mini", priceInr: 5999, quantity: 1 });
  });

  test("adding the same product twice increments quantity instead of duplicating the line", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(product()));
    act(() => result.current.addItem(product()));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  test("total and itemCount reflect quantity across multiple lines", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(product({ id: 1, price_inr: "1000.00" }), 2));
    act(() => result.current.addItem(product({ id: 2, price_inr: "500.00" }), 3));

    expect(result.current.itemCount).toBe(5);
    expect(result.current.total).toBe(1000 * 2 + 500 * 3);
  });

  test("updateQuantity changes an existing line's quantity", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(product()));
    act(() => result.current.updateQuantity(1, 5));

    expect(result.current.items[0].quantity).toBe(5);
  });

  test("updateQuantity to zero or below removes the line entirely", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(product()));
    act(() => result.current.updateQuantity(1, 0));

    expect(result.current.items).toEqual([]);
  });

  test("removeItem removes only the targeted line", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(product({ id: 1 })));
    act(() => result.current.addItem(product({ id: 2 })));
    act(() => result.current.removeItem(1));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].productId).toBe(2);
  });

  test("clearCart empties the cart", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(product()));
    act(() => result.current.clearCart());

    expect(result.current.items).toEqual([]);
  });

  test("persists to localStorage and a fresh provider picks it back up", () => {
    const first = renderCart();
    act(() => first.result.current.addItem(product({ id: 7, name: "Persisted Item" })));

    const second = renderCart();
    expect(second.result.current.items).toHaveLength(1);
    expect(second.result.current.items[0].name).toBe("Persisted Item");
  });

  test("useCart throws when used outside a CartProvider", () => {
    // Suppress React's expected "error boundary" console noise for this
    // one intentionally-erroring render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useCart())).toThrow(/must be used within a CartProvider/);
    } finally {
      spy.mockRestore();
    }
  });
});
