import { Link } from "react-router-dom";
import { useCart } from "../cart/CartContext";

export default function Cart() {
  const { items, updateQuantity, removeItem, total } = useCart();

  if (items.length === 0) {
    return (
      <div>
        <p className="muted">Your cart is empty.</p>
        <Link to="/">Continue shopping</Link>
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
