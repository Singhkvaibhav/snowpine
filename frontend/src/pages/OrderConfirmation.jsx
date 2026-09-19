import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { fetchOrder, fetchConfig, verifyPayment } from "../api/client";
import usePageMeta from "../hooks/usePageMeta";

const STATUS_LABEL = {
  pending: "Pending payment",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return requested",
  returned: "Returned",
  refunded: "Refunded",
};

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrderConfirmation() {
  const { id } = useParams();
  usePageMeta({ title: `Order #${id}` });
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  function reload() {
    fetchOrder(id, token).then(setOrder).catch((e) => setError(e.message));
  }

  useEffect(reload, [id, token]);

  if (error) return <p className="error-text">{error}</p>;
  if (!order) return <p className="muted">Loading...</p>;

  const totalTaxable = order.items.reduce((sum, i) => sum + i.taxable_value, 0);
  const totalGst = order.items.reduce((sum, i) => sum + i.gst_amount, 0);

  // Reopens payment on the SAME Razorpay order rather than creating a new
  // Snowpine order - if a customer's widget got dismissed or their browser
  // hiccuped, starting a fresh checkout instead would reserve the same
  // stock a second time until one of the two reservations expires.
  async function handleCompletePayment() {
    setRetrying(true);
    setError(null);
    try {
      const { razorpayKeyId } = await fetchConfig();
      if (!razorpayKeyId || !window.Razorpay) {
        setError("Payment is not available right now - please try again later or contact support.");
        setRetrying(false);
        return;
      }
      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        order_id: order.razorpay_order_id,
        amount: Math.round(Number(order.total_inr) * 100),
        currency: "INR",
        name: "Snowpine",
        description: `Order #${order.id}`,
        prefill: { name: order.customer_name, email: order.customer_email, contact: order.customer_phone },
        handler: async (response) => {
          try {
            await verifyPayment(order.id, response);
            reload();
          } catch (e) {
            setError(`Payment succeeded but could not be verified: ${e.message}. Contact support with order #${order.id}.`);
          }
        },
        modal: { ondismiss: () => setRetrying(false) },
      });
      rzp.on("payment.failed", (response) => {
        setError(response.error?.description || "Payment failed. Please try again.");
        setRetrying(false);
      });
      rzp.open();
    } catch (e) {
      setError(e.message);
      setRetrying(false);
    }
  }

  const isPaid = ["paid", "shipped", "delivered"].includes(order.status);

  return (
    <div>
      <div className="order-card">
        <div className="order-card-header">
          {isPaid && (
            <span className="order-success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          )}
          <div>
            <h2 style={{ margin: 0 }}>Order #{order.id}</h2>
            <p className="muted" style={{ margin: "0.2rem 0 0" }}>Status: {STATUS_LABEL[order.status] || order.status}</p>
          </div>
        </div>

        {order.status === "refunded" && (
          <p className="muted">
            Refunded {inr(order.refunded_amount_inr)}
            {order.refunded_at && ` on ${new Date(order.refunded_at).toLocaleDateString("en-IN")}`}
          </p>
        )}

        {order.status === "pending" && order.razorpay_order_id && (
          <div style={{ margin: "1rem 0" }}>
            <p className="muted">This order hasn't been paid yet.</p>
            <button className="btn" onClick={handleCompletePayment} disabled={retrying}>
              {retrying ? "Opening payment..." : "Complete payment"}
            </button>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="table-scroll" style={{ marginTop: "1.25rem" }}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Taxable value</th>
                <th>GST</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.product_id}>
                  <td>{i.name}</td>
                  <td>{i.quantity}</td>
                  <td>{inr(i.taxable_value)}</td>
                  <td>{inr(i.gst_amount)} ({(Number(i.gst_rate) * 100).toFixed(0)}%)</td>
                  <td>{inr(i.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
          {Number(order.discount_amount_inr) > 0 && (
            <>
              <p className="muted">Subtotal: {inr(order.subtotal_inr)}</p>
              <p className="muted">Discount ({order.discount_code}): -{inr(order.discount_amount_inr)}</p>
            </>
          )}
          <p className="muted">Taxable value: {inr(totalTaxable)}</p>
          <p className="muted">GST: {inr(totalGst)}</p>
          <h3>Total (incl. GST): {inr(order.total_inr)}</h3>
        </div>

        <p className="muted" style={{ fontSize: "0.82rem" }}>This page is your order confirmation and tax invoice for GST purposes.</p>
      </div>
      <p style={{ marginTop: "1.25rem" }}><Link to="/">Continue shopping</Link></p>
    </div>
  );
}
