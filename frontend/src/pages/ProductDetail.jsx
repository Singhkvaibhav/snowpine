import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProduct, fetchProducts } from "../api/client";
import { useCart } from "../cart/CartContext";
import ProductThumb from "../components/ProductThumb";
import usePageMeta from "../hooks/usePageMeta";

const LOW_STOCK_HINT_THRESHOLD = 5;

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();
  usePageMeta({ title: product?.name, description: product?.description });

  useEffect(() => {
    setProduct(null);
    setAdded(false);
    setQuantity(1);
    setRelated([]);
    fetchProduct(id).then(setProduct).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!product) return;
    // Related products are a bonus for browsing, never something that
    // should block or error out the page if it fails - swallow silently.
    fetchProducts()
      .then((all) => setRelated(all.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)))
      .catch(() => {});
  }, [product]);

  if (error) return <p className="error-text">{error}</p>;
  if (!product) return <p className="muted">Loading...</p>;

  return (
    <div>
      <p className="breadcrumb">
        <Link to="/">Shop</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
        <span aria-hidden="true"> / </span>
        <span className="breadcrumb-current">{product.name}</span>
      </p>
      <div className="product-detail">
        <ProductThumb product={product} style={{ minHeight: 320 }} />
        <div>
          <span className="product-origin">{product.origin_country} · {product.category}</span>
          <h1 className="product-detail-name">{product.name}</h1>
          <p className="product-detail-description">{product.description}</p>
          <p className="product-detail-price">
            ₹{Number(product.price_inr).toLocaleString("en-IN")}
            <span className="product-detail-gst">incl. GST</span>
          </p>

          {product.stock_quantity === 0 ? (
            <p className="stock-badge">Out of stock</p>
          ) : product.stock_quantity <= LOW_STOCK_HINT_THRESHOLD ? (
            <p className="stock-badge">Only {product.stock_quantity} left in stock</p>
          ) : (
            <p className="muted">In stock · ships in 5-10 business days</p>
          )}

          {product.stock_quantity > 0 && (
            <div className="quantity-stepper" role="group" aria-label="Quantity">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                −
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => Math.min(product.stock_quantity, q + 1))}
                disabled={quantity >= product.stock_quantity}
              >
                +
              </button>
            </div>
          )}

          <button
            className="btn"
            disabled={product.stock_quantity === 0}
            onClick={() => {
              addItem(product, quantity);
              setAdded(true);
            }}
          >
            {product.stock_quantity === 0 ? "Out of stock" : added ? "Added ✓" : "Add to cart"}
          </button>
          {added && (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              <Link to="/cart">View cart →</Link>
            </p>
          )}

          <ul className="trust-list">
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Secure payment via Razorpay
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3v4M17 3v4M4 9h16" />
                <rect x="4" y="5" width="16" height="16" rx="2" />
              </svg>
              GST tax invoice emailed with every order
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="6" width="14" height="11" rx="1" /><path d="M15 10h4l3 3v4h-7z" />
                <circle cx="6" cy="19" r="1.6" /><circle cx="17.5" cy="19" r="1.6" />
              </svg>
              Ships across India in 5-10 business days
            </li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="related-products">
          <h2>You may also like</h2>
          <div className="product-grid">
            {related.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="product-card">
                <ProductThumb product={p} />
                <div className="product-card-body">
                  <span className="product-origin">{p.origin_country} · {p.category}</span>
                  <h3 className="product-name">{p.name}</h3>
                  <span className="product-price">₹{Number(p.price_inr).toLocaleString("en-IN")}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
