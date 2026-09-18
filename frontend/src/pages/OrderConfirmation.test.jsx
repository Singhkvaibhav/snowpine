import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import OrderConfirmation from "./OrderConfirmation";
import * as apiClient from "../api/client";

function baseOrder(overrides = {}) {
  return {
    id: 1,
    status: "paid",
    customer_name: "Priya Sharma",
    customer_email: "priya@example.com",
    customer_phone: "9876543210",
    shipping_address: "12 MG Road, Bangalore",
    total_inr: "4399.00",
    razorpay_order_id: null,
    access_token: "test-token",
    items: [
      {
        product_id: 13,
        name: "Kastehelmi Bowl",
        quantity: 1,
        unit_price_inr: "4399.00",
        gst_rate: "0.05",
        taxable_value: 4399 / 1.05,
        gst_amount: 4399 - 4399 / 1.05,
      },
    ],
    ...overrides,
  };
}

function renderOrderPage(token = "test-token") {
  return render(
    <MemoryRouter initialEntries={[`/order/1?token=${token}`]}>
      <Routes>
        <Route path="/order/:id" element={<OrderConfirmation />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete window.Razorpay;
});

describe("OrderConfirmation", () => {
  test("shows an error when the order can't be fetched (e.g. bad/missing token)", async () => {
    vi.spyOn(apiClient, "fetchOrder").mockRejectedValue(new Error("Order not found - check the link from your confirmation email"));
    renderOrderPage();

    expect(await screen.findByText(/order not found/i)).toBeInTheDocument();
  });

  test("renders the GST breakdown correctly for a real 5% rate", async () => {
    vi.spyOn(apiClient, "fetchOrder").mockResolvedValue(baseOrder());
    renderOrderPage();

    expect(await screen.findByText("Kastehelmi Bowl")).toBeInTheDocument();
    // taxable + gst = 4399 exactly, and both individually rounded to 2dp.
    // Appears twice by design (the line item row, and the order summary) -
    // getAllByText, not getByText, is the correct assertion here.
    expect(screen.getAllByText(/₹4,189\.52/)).toHaveLength(2); // taxable value
    expect(screen.getByText(/₹209\.48.*5%/)).toBeInTheDocument(); // gst amount + rate, table only
    expect(screen.getByText(/Total \(incl\. GST\): ₹4,399\.00/)).toBeInTheDocument();
  });

  test("shows the human-readable status label", async () => {
    vi.spyOn(apiClient, "fetchOrder").mockResolvedValue(baseOrder({ status: "shipped" }));
    renderOrderPage();
    expect(await screen.findByText("Status: Shipped")).toBeInTheDocument();
  });

  test("does not show a payment retry option for an already-paid order", async () => {
    vi.spyOn(apiClient, "fetchOrder").mockResolvedValue(baseOrder({ status: "paid" }));
    renderOrderPage();

    await screen.findByText("Kastehelmi Bowl");
    expect(screen.queryByRole("button", { name: /complete payment/i })).not.toBeInTheDocument();
  });

  test("does not show a payment retry option for pending order with no razorpay_order_id (payments unconfigured)", async () => {
    vi.spyOn(apiClient, "fetchOrder").mockResolvedValue(baseOrder({ status: "pending", razorpay_order_id: null }));
    renderOrderPage();

    await screen.findByText("Kastehelmi Bowl");
    expect(screen.queryByRole("button", { name: /complete payment/i })).not.toBeInTheDocument();
  });

  test("shows a payment retry option for a pending order that has a razorpay order attached", async () => {
    vi.spyOn(apiClient, "fetchOrder").mockResolvedValue(baseOrder({ status: "pending", razorpay_order_id: "order_abc" }));
    renderOrderPage();

    expect(await screen.findByRole("button", { name: /complete payment/i })).toBeInTheDocument();
  });

  test("clicking Complete payment opens Razorpay with the SAME razorpay_order_id, not a new order", async () => {
    vi.spyOn(apiClient, "fetchOrder").mockResolvedValue(baseOrder({ status: "pending", razorpay_order_id: "order_abc" }));
    vi.spyOn(apiClient, "fetchConfig").mockResolvedValue({ razorpayKeyId: "rzp_test_key" });

    const openMock = vi.fn();
    const onMock = vi.fn();
    window.Razorpay = vi.fn().mockImplementation((opts) => {
      window.Razorpay.lastOpts = opts;
      return { open: openMock, on: onMock };
    });

    renderOrderPage();
    const button = await screen.findByRole("button", { name: /complete payment/i });
    await userEvent.click(button);

    await waitFor(() => expect(openMock).toHaveBeenCalled());
    expect(window.Razorpay).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "order_abc", key: "rzp_test_key" })
    );
  });

  test("shows an error and does not crash if payments are unavailable when retrying", async () => {
    vi.spyOn(apiClient, "fetchOrder").mockResolvedValue(baseOrder({ status: "pending", razorpay_order_id: "order_abc" }));
    vi.spyOn(apiClient, "fetchConfig").mockResolvedValue({ razorpayKeyId: null });

    renderOrderPage();
    const button = await screen.findByRole("button", { name: /complete payment/i });
    await userEvent.click(button);

    expect(await screen.findByText(/payment is not available right now/i)).toBeInTheDocument();
  });
});
