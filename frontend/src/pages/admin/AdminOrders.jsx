import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminFetchOrders,
  adminUpdateOrderStatus,
  adminRequestReturn,
  adminMarkReturned,
  adminRefundOrder,
} from "../../api/client";

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
                <th>Returns</th>
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
                      disabled={["return_requested", "returned", "refunded"].includes(o.status)}
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
                      {["return_requested", "returned", "refunded"].includes(o.status) && (
                        <option value={o.status}>{o.status}</option>
                      )}
                    </select>
                  </td>
                  <td>
                    <ReturnAction order={o} token={token} onChange={(updated) => setOrders((prev) => prev.map((x) => (x.id === o.id ? updated : x)))} onError={setError} />
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

// Returns/refunds are a state machine (see ordersService.js), so only one
// action is ever valid at a time - the button shown here always maps
// directly to the order's current status rather than offering every
// action and letting the server reject the invalid ones.
function ReturnAction({ order, token, onChange, onError }) {
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    try {
      const updated = await action(token, order.id);
      onChange(updated);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (order.status === "delivered") {
    return (
      <button className="btn btn-secondary" disabled={busy} onClick={() => run(adminRequestReturn)}>
        Request return
      </button>
    );
  }
  if (order.status === "return_requested") {
    return (
      <button className="btn btn-secondary" disabled={busy} onClick={() => run(adminMarkReturned)}>
        Mark restocked
      </button>
    );
  }
  if (order.status === "returned") {
    return (
      <button className="btn btn-secondary" disabled={busy} onClick={() => run(adminRefundOrder)}>
        Refund
      </button>
    );
  }
  if (order.status === "refunded") {
    return (
      <span className="muted">
        Refunded ₹{Number(order.refunded_amount_inr).toLocaleString("en-IN")}
        {order.refunded_at && ` on ${new Date(order.refunded_at).toLocaleDateString("en-IN")}`}
      </span>
    );
  }
  return <span className="muted">-</span>;
}
