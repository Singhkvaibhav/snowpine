import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetchSalesOverview } from "../../api/client";
import AdminNav from "./AdminNav";

const TOKEN_KEY = "snowpine_admin_token";
const STATUS_ORDER = ["pending", "paid", "shipped", "delivered", "cancelled", "return_requested", "returned", "refunded"];
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

export default function AdminSalesOverview() {
  const [token] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    adminFetchSalesOverview(token).then(setOverview).catch((e) => setError(e.message));
  }, [token]);

  if (!token) {
    return (
      <p className="muted">
        <Link to="/admin/products">Sign in on the products page</Link> first.
      </p>
    );
  }

  return (
    <div>
      <h2>Sales overview</h2>
      <AdminNav />
      {error && <p className="error-text">{error}</p>}
      {!overview ? (
        <p className="muted">Loading...</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "1.5rem" }}>
            Counts paid, shipped, and delivered orders only - a pending order may never be paid,
            and a cancelled one was reversed.
          </p>
          <div className="stat-cards">
            <div className="stat-card">
              <p className="stat-card-label">Total revenue</p>
              <p className="stat-card-value">₹{overview.totalRevenue.toLocaleString("en-IN")}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-label">Orders (paid+)</p>
              <p className="stat-card-value">{overview.orderCount}</p>
            </div>
          </div>

          <h3>Orders by status</h3>
          <div className="admin-card" style={{ maxWidth: 420 }}>
            <div className="admin-table-wrap">
              <table>
                <tbody>
                  {STATUS_ORDER.map((s) => (
                    <tr key={s}>
                      <td>{STATUS_LABEL[s]}</td>
                      <td>{overview.ordersByStatus[s] || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h3 style={{ marginTop: "2rem" }}>Top-selling products</h3>
          {overview.topProducts.length === 0 ? (
            <p className="muted">No completed sales yet.</p>
          ) : (
            <div className="admin-card">
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.topProducts.map((p) => (
                      <tr key={p.productId}>
                        <td>{p.name}</td>
                        <td>{p.unitsSold}</td>
                        <td>₹{p.revenue.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
