import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchMyOrders } from "../api/client";

const STATUS_LABEL = {
  pending: "Pending payment",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function MyOrders() {
  const { customer, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!customer) return;
    fetchMyOrders().then(setOrders).catch((e) => setError(e.message));
  }, [customer]);

  if (authLoading) return <p className="muted">Loading...</p>;
  if (!customer) return <Navigate to="/login" replace />;

  return (
    <div>
      <h2>Your orders</h2>
      {error && <p className="error-text">{error}</p>}
      {!orders ? (
        <p className="muted">Loading...</p>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h18v18H3z" opacity="0" />
            <rect x="3" y="7" width="18" height="14" rx="2" />
            <path d="M8 7V5a4 4 0 0 1 8 0v2" />
          </svg>
          <p>You haven't placed any orders yet.</p>
          <Link to="/"><button className="btn">Start shopping</button></Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Status</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{new Date(o.created_at).toLocaleDateString("en-IN")}</td>
                  <td>{STATUS_LABEL[o.status] || o.status}</td>
                  <td>₹{Number(o.total_inr).toLocaleString("en-IN")}</td>
                  <td>
                    <Link to={`/order/${o.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
