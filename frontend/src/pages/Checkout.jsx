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
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerPhone: "", shippingAddress: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Convenience only, not a requirement - a logged-in customer's contact
  // details prefill but stay editable (e.g. shipping somewhere else),
  // and only fills in fields still blank so it never clobbers something
  // the customer already typed.
  useEffect(() => {
    if (!customer) return;
    setForm((prev) => ({
      customerName: prev.customerName || customer.name,
      customerEmail: prev.customerEmail || customer.email,
      customerPhone: prev.customerPhone || customer.phone,
      shippingAddress: prev.shippingAddress,
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
        amount: Math.round(total * 100),
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

      <form onSubmit={handleSubmit} className="form-grid">
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

        <h3>Total: ₹{total.toLocaleString("en-IN")}</h3>
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Processing..." : "Pay and place order"}
        </button>
      </form>
    </div>
  );
}
