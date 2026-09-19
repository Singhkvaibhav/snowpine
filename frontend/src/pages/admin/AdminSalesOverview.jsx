import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetchSalesOverview } from "../../api/client";

const TOKEN_KEY = "snowpine_admin_token";
const STATUS_ORDER = ["pending", "paid", "shipped", "delivered", "cancelled"];
const STATUS_LABEL = {
  pending: "Pending payment",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
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
      <p className="muted">
        <Link to="/admin">Orders</Link> · <Link to="/admin/products">Products</Link> ·{" "}
        <Link to="/admin/stock-activity">Stock activity</Link> ·{" "}
        <Link to="/admin/discount-codes">Discount codes</Link>
      </p>
      {error && <p className="error-text">{error}</p>}
      {!overview ? (
        <p className="muted">Loading...</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Counts paid, shipped, and delivered orders only - a pending order may never be paid,
            and a cancelled one was reversed.
          </p>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", margin: "1.5rem 0" }}>
            <div>
              <p className="muted" style={{ margin: 0 }}>Total revenue</p>
              <h1 style={{ margin: 0 }}>₹{overview.totalRevenue.toLocaleString("en-IN")}</h1>
            </div>
            <div>
              <p className="muted" style={{ margin: 0 }}>Orders (paid+)</p>
              <h1 style={{ margin: 0 }}>{overview.orderCount}</h1>
            </div>
          </div>

          <h3>Orders by status</h3>
          <div className="table-scroll">
            <table style={{ maxWidth: 420 }}>
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

          <h3 style={{ marginTop: "2rem" }}>Top-selling products</h3>
          {overview.topProducts.length === 0 ? (
            <p className="muted">No completed sales yet.</p>
          ) : (
            <div className="table-scroll">
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
          )}
        </>
      )}
    </div>
  );
}
