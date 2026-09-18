import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import * as apiClient from "../api/client";

beforeEach(() => {
  vi.restoreAllMocks();
});

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

describe("AuthContext", () => {
  test("starts loading, then resolves to logged-out when /me returns null", async () => {
    vi.spyOn(apiClient, "fetchMe").mockResolvedValue(null);
    const { result } = renderAuth();

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.customer).toBeNull();
  });

  test("resolves to logged-in when /me returns a customer", async () => {
    const customer = { id: 1, name: "Priya Sharma", email: "priya@example.com", phone: "9876543210" };
    vi.spyOn(apiClient, "fetchMe").mockResolvedValue(customer);
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.customer).toEqual(customer);
  });

  test("treats a failed /me check as logged out, not an error state", async () => {
    vi.spyOn(apiClient, "fetchMe").mockRejectedValue(new Error("network error"));
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.customer).toBeNull();
  });

  test("signup logs the customer in immediately without a separate /me round-trip", async () => {
    vi.spyOn(apiClient, "fetchMe").mockResolvedValue(null);
    const newCustomer = { id: 2, name: "New Customer", email: "new@example.com", phone: "9111111111" };
    vi.spyOn(apiClient, "signup").mockResolvedValue(newCustomer);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signup({ name: "New Customer", email: "new@example.com", phone: "9111111111", password: "pass1234" });
    });

    expect(result.current.customer).toEqual(newCustomer);
  });

  test("login updates customer state", async () => {
    vi.spyOn(apiClient, "fetchMe").mockResolvedValue(null);
    const customer = { id: 1, name: "Priya Sharma", email: "priya@example.com", phone: "9876543210" };
    vi.spyOn(apiClient, "login").mockResolvedValue(customer);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login({ email: "priya@example.com", password: "secretpass123" });
    });

    expect(result.current.customer).toEqual(customer);
  });

  test("a failed login leaves customer state unchanged (still logged out)", async () => {
    vi.spyOn(apiClient, "fetchMe").mockResolvedValue(null);
    vi.spyOn(apiClient, "login").mockRejectedValue(new Error("Invalid email or password"));

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.login({ email: "x@example.com", password: "wrong" })).rejects.toThrow(
        "Invalid email or password"
      );
    });

    expect(result.current.customer).toBeNull();
  });

  test("logout clears customer state", async () => {
    const customer = { id: 1, name: "Priya Sharma", email: "priya@example.com", phone: "9876543210" };
    vi.spyOn(apiClient, "fetchMe").mockResolvedValue(customer);
    vi.spyOn(apiClient, "logout").mockResolvedValue(undefined);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.customer).toEqual(customer));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.customer).toBeNull();
  });

  test("useAuth throws when used outside an AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useAuth())).toThrow(/must be used within an AuthProvider/);
    } finally {
      spy.mockRestore();
    }
  });
});
