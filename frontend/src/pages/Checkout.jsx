import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../cart/CartContext";
import { useAuth } from "../auth/AuthContext";
import { placeOrder, verifyPayment } from "../api/client";
import usePageMeta from "../hooks/usePageMeta";

export default function Checkout() {
  usePageMeta({ title: "Checkout" });
  const { items, total, clearCart } = useCart();
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    shippingAddress: "",
    discountCode: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Convenience only, not a requirement - a logged-in customer's contact
  // details prefill but stay editable (e.g. shipping somewhere else),
  // and only fills in fields still blank so it never clobbers something
  // the customer already typed.
  useEffect(() => {
    if (!customer) return;
    setForm((prev) => ({
      ...prev,
      customerName: prev.customerName || customer.name,
      customerEmail: prev.customerEmail || customer.email,
      customerPhone: prev.customerPhone || customer.phone,
    }));
  }, [customer]);

  if (items.length === 0) {
    return (
      <div>
        <p className="muted">Your cart is empty.</p>
        <Link to="/">Continue shopping</Link>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { order, razorpayOrderId, razorpayKeyId } = await placeOrder({
        ...form,
        discountCode: form.discountCode.trim() || undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });

      if (!razorpayOrderId) {
        // Razorpay isn't configured (e.g. local dev without keys) - order
        // stays "pending" with no payment collected, same as before.
        clearCart();
        navigate(`/order/${order.id}?token=${order.access_token}`);
        return;
      }

      if (!window.Razorpay) {
        setError("Payment widget failed to load - check your connection and try again.");
        setSubmitting(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        order_id: razorpayOrderId,
        // The order's own (possibly discounted) total, not the cart's
        // pre-discount total - a valid discount code makes these differ,
        // and the Razorpay order was created server-side against the
        // discounted amount (see attachRazorpayOrder).
        amount: Math.round(Number(order.total_inr) * 100),
        currency: "INR",
        name: "Snowpine",
        description: `Order #${order.id}`,
        prefill: { name: form.customerName, email: form.customerEmail, contact: form.customerPhone },
        handler: async (response) => {
          try {
            await verifyPayment(order.id, response);
            clearCart();
            navigate(`/order/${order.id}?token=${order.access_token}`);
          } catch (e) {
            setError(`Payment succeeded but could not be verified: ${e.message}. Contact support with order #${order.id}.`);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
      rzp.on("payment.failed", (response) => {
        setError(response.error?.description || "Payment failed. Please try again.");
        setSubmitting(false);
      });
      rzp.open();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2>Checkout</h2>
      <p className="muted">Your items are reserved for 30 minutes while you complete payment.</p>

      {error && <p className="error-text">{error}</p>}

      <div className="checkout-layout">
        <form onSubmit={handleSubmit} className="form-grid" style={{ maxWidth: "none" }}>
          <label>
            Name
            <input
              required
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={form.customerEmail}
              onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
            />
          </label>
          <label>
            Phone (for delivery)
            <input
              required
              type="tel"
              pattern="[0-9+ ]{10,15}"
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
            />
          </label>
          <label>
            Shipping address
            <textarea
              required
              value={form.shippingAddress}
              onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
            />
          </label>
          <label>
            Discount code (optional)
            <input
              value={form.discountCode}
              onChange={(e) => setForm({ ...form, discountCode: e.target.value })}
              placeholder="e.g. WELCOME10"
            />
          </label>

          <button className="btn" type="submit" disabled={submitting} style={{ marginTop: "0.5rem" }}>
            {submitting ? "Processing..." : "Pay and place order"}
          </button>
        </form>

        <aside className="order-summary">
          <h3>Order summary</h3>
          <ul className="order-summary-items">
            {items.map((i) => (
              <li key={i.productId}>
                <span>{i.name} <span className="muted">×{i.quantity}</span></span>
                <span>₹{(i.priceInr * i.quantity).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
          <div className="order-summary-row total">
            <span>Total</span>
            <span>₹{total.toLocaleString("en-IN")}</span>
          </div>
          {form.discountCode.trim() && (
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              Discount code applied at checkout - the confirmed total appears on the next page.
            </p>
          )}
          <p className="muted" style={{ fontSize: "0.78rem" }}>GST breakdown shown on your order confirmation.</p>
        </aside>
      </div>
    </div>
  );
}
