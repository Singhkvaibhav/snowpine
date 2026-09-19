import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetchOrders, adminUpdateOrderStatus } from "../../api/client";

const STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];
const TOKEN_KEY = "snowpine_admin_token";

export default function AdminOrders() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [tokenInput, setTokenInput] = useState("");
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  function load(t) {
    setError(null);
    adminFetchOrders(t)
      .then(setOrders)
      .catch((e) => {
        setError(e.message);
        if (e.message === "Invalid admin token") {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken("");
        }
      });
  }

  useEffect(() => {
    if (token) load(token);
  }, [token]);

  if (!token) {
    return (
      <div>
        <h2>Admin</h2>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            sessionStorage.setItem(TOKEN_KEY, tokenInput);
            setToken(tokenInput);
          }}
        >
          <label>
            Admin token
            <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} required />
          </label>
          <button className="btn" type="submit">Sign in</button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <h2>Orders</h2>
      <p className="muted">
        <Link to="/admin/products">Products</Link> · <Link to="/admin/sales">Sales overview</Link> ·{" "}
        <Link to="/admin/stock-activity">Stock activity</Link>
      </p>
      {error && <p className="error-text">{error}</p>}
      {!orders ? (
        <p className="muted">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.customer_name}<br /><span className="muted">{o.customer_email}</span></td>
                  <td>{o.customer_phone}</td>
                  <td>{o.shipping_address}</td>
                  <td>₹{Number(o.total_inr).toLocaleString("en-IN")}</td>
                  <td>
                    <select
                      value={o.status}
                      onChange={async (e) => {
                        const status = e.target.value;
                        try {
                          const updated = await adminUpdateOrderStatus(token, o.id, status);
                          setOrders((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
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
