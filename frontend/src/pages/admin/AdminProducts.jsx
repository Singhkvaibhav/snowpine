import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetchProducts, adminUpdateProduct, adminCreateProduct } from "../../api/client";

const TOKEN_KEY = "snowpine_admin_token";
const NEW_PRODUCT_DEFAULTS = {
  name: "",
  description: "",
  origin_country: "",
  category: "",
  price_inr: "",
  stock_quantity: "0",
  gst_rate: "0.18",
  reorder_point: "5",
};

function EditableRow({ product, onSave }) {
  const [price, setPrice] = useState(product.price_inr);
  const [stock, setStock] = useState(product.stock_quantity);
  const [reorderPoint, setReorderPoint] = useState(product.reorder_point);
  const [saving, setSaving] = useState(false);
  const lowStock = Number(product.stock_quantity) <= Number(product.reorder_point);
  const dirty =
    String(price) !== String(product.price_inr) ||
    String(stock) !== String(product.stock_quantity) ||
    String(reorderPoint) !== String(product.reorder_point);

  return (
    <tr style={lowStock ? { background: "#fff4e5" } : undefined}>
      <td>
        {product.name}
        {lowStock && <span className="stock-badge" style={{ display: "block" }}>Low stock</span>}
      </td>
      <td className="muted">{product.category}</td>
      <td>
        <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: "6rem" }} />
      </td>
      <td>
        <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} style={{ width: "4rem" }} />
      </td>
      <td>
        <input type="number" min="0" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} style={{ width: "4rem" }} />
      </td>
      <td>
        <button
          className="btn"
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(product.id, {
                price_inr: Number(price),
                stock_quantity: Number(stock),
                reorder_point: Number(reorderPoint),
              });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </td>
    </tr>
  );
}

export default function AdminProducts() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [tokenInput, setTokenInput] = useState("");
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [newProduct, setNewProduct] = useState(NEW_PRODUCT_DEFAULTS);
  const [creating, setCreating] = useState(false);

  function load(t) {
    setError(null);
    adminFetchProducts(t)
      .then(setProducts)
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

  async function handleSave(id, fields) {
    try {
      const updated = await adminUpdateProduct(token, id, fields);
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await adminCreateProduct(token, {
        ...newProduct,
        price_inr: Number(newProduct.price_inr),
        stock_quantity: Number(newProduct.stock_quantity),
        gst_rate: Number(newProduct.gst_rate),
        reorder_point: Number(newProduct.reorder_point),
      });
      setProducts((prev) => [created, ...prev]);
      setNewProduct(NEW_PRODUCT_DEFAULTS);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  const lowStockCount = products ? products.filter((p) => p.stock_quantity <= p.reorder_point).length : 0;

  return (
    <div>
      <h2>Products</h2>
      <p className="muted">
        <Link to="/admin">Orders</Link> · <Link to="/admin/sales">Sales overview</Link> ·{" "}
        <Link to="/admin/stock-activity">Stock activity</Link>
      </p>
      {lowStockCount > 0 && (
        <p className="error-text">
          {lowStockCount} product{lowStockCount === 1 ? "" : "s"} at or below its reorder point - highlighted below.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}

      {!products ? (
        <p className="muted">Loading...</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price (₹)</th>
                <th>Stock</th>
                <th>Reorder at</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <EditableRow key={p.id} product={p} onSave={handleSave} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginTop: "2rem" }}>Add a product</h3>
      <form onSubmit={handleCreate} className="form-grid">
        <label>
          Name
          <input required value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
        </label>
        <label>
          Description
          <textarea required value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
        </label>
        <label>
          Origin country
          <input required value={newProduct.origin_country} onChange={(e) => setNewProduct({ ...newProduct, origin_country: e.target.value })} />
        </label>
        <label>
          Category
          <input required value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />
        </label>
        <label>
          Price (₹, incl. GST)
          <input required type="number" min="0" step="0.01" value={newProduct.price_inr} onChange={(e) => setNewProduct({ ...newProduct, price_inr: e.target.value })} />
        </label>
        <label>
          Stock quantity
          <input type="number" min="0" value={newProduct.stock_quantity} onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })} />
        </label>
        <label>
          Reorder point (flag as low stock at or below this)
          <input type="number" min="0" value={newProduct.reorder_point} onChange={(e) => setNewProduct({ ...newProduct, reorder_point: e.target.value })} />
        </label>
        <label>
          GST rate (e.g. 0.18 for 18%, 0.05 for 5%)
          <input type="number" min="0" max="1" step="0.01" value={newProduct.gst_rate} onChange={(e) => setNewProduct({ ...newProduct, gst_rate: e.target.value })} />
        </label>
        <button className="btn" type="submit" disabled={creating}>
          {creating ? "Adding..." : "Add product"}
        </button>
      </form>
    </div>
  );
}
