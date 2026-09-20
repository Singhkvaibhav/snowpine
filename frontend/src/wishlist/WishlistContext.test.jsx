import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { WishlistProvider, useWishlist } from "./WishlistContext";
import * as AuthContext from "../auth/AuthContext";
import * as apiClient from "../api/client";

const product = (overrides = {}) => ({ id: 1, name: "Kastehelmi Bowl", price_inr: "3399.00", ...overrides });

function renderWishlist() {
  return renderHook(() => useWishlist(), { wrapper: WishlistProvider });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("WishlistContext", () => {
  test("stays empty and never fetches when logged out", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null });
    const fetchSpy = vi.spyOn(apiClient, "fetchWishlist");
    const { result } = renderWishlist();

    expect(result.current.items).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("fetches the wishlist once logged in", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchWishlist").mockResolvedValue([product()]);
    const { result } = renderWishlist();

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.isSaved(1)).toBe(true);
    expect(result.current.isSaved(999)).toBe(false);
  });

  test("toggle adds a product optimistically and calls the API", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchWishlist").mockResolvedValue([]);
    const addSpy = vi.spyOn(apiClient, "addToWishlist").mockResolvedValue();
    const { result } = renderWishlist();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.toggle(product()));

    expect(result.current.isSaved(1)).toBe(true);
    expect(addSpy).toHaveBeenCalledWith(1);
  });

  test("toggle removes an already-saved product and calls the API", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchWishlist").mockResolvedValue([product()]);
    const removeSpy = vi.spyOn(apiClient, "removeFromWishlist").mockResolvedValue();
    const { result } = renderWishlist();
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => result.current.toggle(product()));

    expect(result.current.isSaved(1)).toBe(false);
    expect(removeSpy).toHaveBeenCalledWith(1);
  });

  test("reverts the optimistic add if the API call fails", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchWishlist").mockResolvedValue([]);
    vi.spyOn(apiClient, "addToWishlist").mockRejectedValue(new Error("failed"));
    const { result } = renderWishlist();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.toggle(product()));

    expect(result.current.isSaved(1)).toBe(false);
  });

  test("clears items when the customer logs out", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: { id: 1 } });
    vi.spyOn(apiClient, "fetchWishlist").mockResolvedValue([product()]);
    const { result, rerender } = renderHook(() => useWishlist(), { wrapper: WishlistProvider });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    vi.spyOn(AuthContext, "useAuth").mockReturnValue({ customer: null });
    rerender();

    await waitFor(() => expect(result.current.items).toHaveLength(0));
  });
});
