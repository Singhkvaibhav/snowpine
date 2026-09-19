import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetchDiscountCodes, adminCreateDiscountCode, adminUpdateDiscountCode } from "../../api/client";

const TOKEN_KEY = "snowpine_admin_token";
const NEW_CODE_DEFAULTS = { code: "", type: "percent", value: "10", max_uses: "", min_order_inr: "", expires_at: "" };

function formatValue(code) {
  return code.type === "percent" ? `${Number(code.value)}%` : `₹${Number(code.value).toLocaleString("en-IN")}`;
}

function isExpired(code) {
  return code.expires_at && new Date(code.expires_at) < new Date();
}

export default function AdminDiscountCodes() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [tokenInput, setTokenInput] = useState("");
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState(null);
  const [newCode, setNewCode] = useState(NEW_CODE_DEFAULTS);
  const [creating, setCreating] = useState(false);

  function load(t) {
    setError(null);
    adminFetchDiscountCodes(t)
      .then(setCodes)
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

  async function toggleActive(code) {
    try {
      const updated = await adminUpdateDiscountCode(token, code.id, { active: !code.active });
      setCodes((prev) => prev.map((c) => (c.id === code.id ? updated : c)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await adminCreateDiscountCode(token, {
        code: newCode.code,
        type: newCode.type,
        value: Number(newCode.value),
        max_uses: newCode.max_uses ? Number(newCode.max_uses) : null,
        min_order_inr: newCode.min_order_inr ? Number(newCode.min_order_inr) : null,
        expires_at: newCode.expires_at || null,
      });
      setCodes((prev) => [created, ...prev]);
      setNewCode(NEW_CODE_DEFAULTS);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h2>Discount codes</h2>
      <p className="muted">
        <Link to="/admin">Orders</Link> · <Link to="/admin/products">Products</Link> ·{" "}
        <Link to="/admin/sales">Sales overview</Link> · <Link to="/admin/stock-activity">Stock activity</Link>
      </p>
      {error && <p className="error-text">{error}</p>}

      {!codes ? (
        <p className="muted">Loading...</p>
      ) : codes.length === 0 ? (
        <p className="muted">No discount codes yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Value</th>
                <th>Min order</th>
                <th>Uses</th>
                <th>Expires</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const expired = isExpired(c);
                const usedUp = c.max_uses != null && c.uses_count >= c.max_uses;
                return (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>{formatValue(c)}</td>
                    <td>{c.min_order_inr ? `₹${Number(c.min_order_inr).toLocaleString("en-IN")}` : "-"}</td>
                    <td>{c.uses_count}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</td>
                    <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-IN") : "-"}</td>
                    <td>
                      {!c.active ? "Deactivated" : expired ? "Expired" : usedUp ? "Used up" : "Active"}
                    </td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => toggleActive(c)}>
                        {c.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginTop: "2rem" }}>Create a discount code</h3>
      <form onSubmit={handleCreate} className="form-grid">
        <label>
          Code
          <input
            required
            value={newCode.code}
            onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
            placeholder="e.g. WELCOME10"
          />
        </label>
        <label>
          Type
          <select value={newCode.type} onChange={(e) => setNewCode({ ...newCode, type: e.target.value })}>
            <option value="percent">Percent off</option>
            <option value="flat">Flat amount off (₹)</option>
          </select>
        </label>
        <label>
          Value {newCode.type === "percent" ? "(0-100)" : "(₹)"}
          <input
            required
            type="number"
            min="0"
            max={newCode.type === "percent" ? "100" : undefined}
            step="0.01"
            value={newCode.value}
            onChange={(e) => setNewCode({ ...newCode, value: e.target.value })}
          />
        </label>
        <label>
          Max uses (optional, blank = unlimited)
          <input
            type="number"
            min="1"
            value={newCode.max_uses}
            onChange={(e) => setNewCode({ ...newCode, max_uses: e.target.value })}
          />
        </label>
        <label>
          Minimum order value (optional, ₹)
          <input
            type="number"
            min="0"
            value={newCode.min_order_inr}
            onChange={(e) => setNewCode({ ...newCode, min_order_inr: e.target.value })}
          />
        </label>
        <label>
          Expires on (optional)
          <input
            type="date"
            value={newCode.expires_at}
            onChange={(e) => setNewCode({ ...newCode, expires_at: e.target.value })}
          />
        </label>
        <button className="btn" type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create code"}
        </button>
      </form>
    </div>
  );
}
