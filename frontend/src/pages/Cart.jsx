import { Link } from "react-router-dom";
import { useCart } from "../cart/CartContext";
import ProductThumb from "../components/ProductThumb";
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
      <div className="cart-layout">
        <div className="cart-items">
          {items.map((i) => (
            <div className="cart-row" key={i.productId}>
              <ProductThumb
                product={{ name: i.name, category: i.category }}
                style={{ width: "72px", aspectRatio: "1", borderRadius: "8px", flexShrink: 0 }}
              />
              <div className="cart-row-info">
                <span className="cart-row-name">{i.name}</span>
                <span className="muted">₹{i.priceInr.toLocaleString("en-IN")} each</span>
              </div>
              <div className="quantity-stepper">
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${i.name}`}
                  onClick={() => updateQuantity(i.productId, i.quantity - 1)}
                  disabled={i.quantity <= 1}
                >
                  −
                </button>
                <span>{i.quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${i.name}`}
                  onClick={() => updateQuantity(i.productId, i.quantity + 1)}
                >
                  +
                </button>
              </div>
              <span className="cart-row-subtotal">₹{(i.priceInr * i.quantity).toLocaleString("en-IN")}</span>
              <button className="cart-row-remove" aria-label={`Remove ${i.name} from cart`} onClick={() => removeItem(i.productId)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <aside className="order-summary">
          <h3>Order summary</h3>
          <div className="order-summary-row total">
            <span>Subtotal</span>
            <span>₹{total.toLocaleString("en-IN")}</span>
          </div>
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            GST breakdown and any discount code are calculated at checkout.
          </p>
          <Link to="/checkout" className="btn" style={{ width: "100%", marginTop: "0.75rem" }}>
            Proceed to checkout
          </Link>
          <Link to="/" className="hero-link" style={{ display: "block", marginTop: "0.9rem", textAlign: "center" }}>
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
