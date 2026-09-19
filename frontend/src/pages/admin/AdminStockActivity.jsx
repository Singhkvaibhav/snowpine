import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetchStockMovements } from "../../api/client";

const TOKEN_KEY = "snowpine_admin_token";
const REASON_LABEL = {
  order_placed: "Order placed",
  order_released: "Order released (expired/failed)",
  admin_adjustment: "Manual adjustment",
};

export default function AdminStockActivity() {
  const [token] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [movements, setMovements] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    adminFetchStockMovements(token).then(setMovements).catch((e) => setError(e.message));
  }, [token]);

  if (!token) {
    return (
      <div>
        <p className="muted">
          <Link to="/admin/products">Sign in on the products page</Link> first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Stock activity</h2>
      <p className="muted">
        <Link to="/admin">Orders</Link> · <Link to="/admin/products">Products</Link> ·{" "}
        <Link to="/admin/sales">Sales overview</Link>
      </p>
      {error && <p className="error-text">{error}</p>}
      {!movements ? (
        <p className="muted">Loading...</p>
      ) : movements.length === 0 ? (
        <p className="muted">No stock movements yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Change</th>
                <th>Reason</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.product_name}</td>
                  <td style={{ color: m.delta < 0 ? "var(--danger)" : "inherit" }}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td>{REASON_LABEL[m.reason] || m.reason}</td>
                  <td className="muted">{new Date(m.created_at).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
