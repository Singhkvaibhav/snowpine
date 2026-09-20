import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { useWishlist } from "../wishlist/WishlistContext";
import ProductThumb from "../components/ProductThumb";
import WishlistButton from "../components/WishlistButton";
import usePageMeta from "../hooks/usePageMeta";

export default function MyWishlist() {
  usePageMeta({ title: "Your Wishlist" });
  const { customer, loading: authLoading } = useAuth();
  const { items, loading } = useWishlist();
  const { addItem } = useCart();

  if (authLoading) return <p className="muted">Loading...</p>;
  if (!customer) return <Navigate to="/login" replace />;

  return (
    <div>
      <h2>Your wishlist</h2>
      {loading ? (
        <p className="muted">Loading...</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <p>Nothing saved yet.</p>
          <Link to="/"><button className="btn">Browse products</button></Link>
        </div>
      ) : (
        <div className="product-grid">
          {items.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="product-card">
              <div className="product-thumb-wrap">
                <ProductThumb product={p} />
                <WishlistButton product={p} />
              </div>
              <div className="product-card-body">
                <span className="product-origin">{p.origin_country} · {p.category}</span>
                <h3 className="product-name">{p.name}</h3>
                <span className="product-price">₹{Number(p.price_inr).toLocaleString("en-IN")}</span>
                <button
                  className="btn"
                  disabled={p.stock_quantity === 0}
                  onClick={(e) => {
                    e.preventDefault();
                    addItem(p);
                  }}
                >
                  {p.stock_quantity === 0 ? "Out of stock" : "Add to cart"}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
