import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProduct } from "../api/client";
import { useCart } from "../cart/CartContext";
import ProductThumb from "../components/ProductThumb";
import usePageMeta from "../hooks/usePageMeta";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  usePageMeta({ title: product?.name, description: product?.description });

  useEffect(() => {
    setProduct(null);
    setAdded(false);
    fetchProduct(id).then(setProduct).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!product) return <p className="muted">Loading...</p>;

  return (
    <div>
      <p><Link to="/">&larr; Back to shop</Link></p>
      <div className="product-detail">
        <ProductThumb product={product} style={{ minHeight: 320 }} />
        <div>
          <span className="product-origin">{product.origin_country} · {product.category}</span>
          <h1 className="product-name" style={{ fontSize: "1.6rem", margin: "0.4rem 0" }}>{product.name}</h1>
          <p>{product.description}</p>
          <p className="product-price" style={{ fontSize: "1.4rem" }}>
            ₹{Number(product.price_inr).toLocaleString("en-IN")}
          </p>
          {product.stock_quantity === 0 ? (
            <p className="stock-badge">Out of stock</p>
          ) : (
            <p className="muted">{product.stock_quantity} in stock</p>
          )}
          <button
            className="btn"
            disabled={product.stock_quantity === 0}
            onClick={() => {
              addItem(product);
              setAdded(true);
            }}
          >
            {product.stock_quantity === 0 ? "Out of stock" : added ? "Added ✓" : "Add to cart"}
          </button>
          {added && <p className="muted" style={{ marginTop: "0.75rem" }}><Link to="/cart">View cart</Link></p>}
        </div>
      </div>
    </div>
  );
}
