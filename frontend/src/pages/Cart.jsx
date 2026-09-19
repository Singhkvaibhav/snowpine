import { Link } from "react-router-dom";
import { useCart } from "../cart/CartContext";
import usePageMeta from "../hooks/usePageMeta";

export default function Cart() {
  const { items, updateQuantity, removeItem, total } = useCart();
  usePageMeta({ title: "Your Cart" });

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <p>Your cart is empty.</p>
        <Link to="/"><button className="btn">Continue shopping</button></Link>
      </div>
    );
  }

  return (
    <div>
      <h2>Your cart</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.productId}>
                <td>{i.name}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={i.quantity}
                    onChange={(e) => updateQuantity(i.productId, parseInt(e.target.value, 10) || 0)}
                    style={{ width: "3.5rem" }}
                  />
                </td>
                <td>₹{i.priceInr.toLocaleString("en-IN")}</td>
                <td>₹{(i.priceInr * i.quantity).toLocaleString("en-IN")}</td>
                <td>
                  <button className="btn-secondary btn" onClick={() => removeItem(i.productId)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ textAlign: "right" }}>Total: ₹{total.toLocaleString("en-IN")}</h3>
      <div style={{ textAlign: "right" }}>
        <Link to="/checkout">
          <button className="btn">Proceed to checkout</button>
        </Link>
      </div>
    </div>
  );
}
