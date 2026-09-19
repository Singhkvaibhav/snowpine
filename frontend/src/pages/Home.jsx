import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProducts } from "../api/client";
import { useCart } from "../cart/CartContext";
import ProductThumb from "../components/ProductThumb";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const { addItem } = useCart();

  useEffect(() => {
    fetchProducts().then(setProducts).catch((e) => setError(e.message));
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const visible = products.filter((p) => {
    const inCategory = activeCategory === "All" || p.category === activeCategory;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.origin_country.toLowerCase().includes(query);
    return inCategory && matchesSearch;
  });

  return (
    <div>
      <section className="hero">
        <h1>Nordic craftsmanship, delivered to your door</h1>
        <p>Curated baby gear, home design, and skincare from Sweden, Finland, Denmark, and Norway - authentic, and ready to ship across India.</p>
        <div className="hero-badges">
          <span className="hero-badge">Curated from trusted Nordic brands</span>
          <span className="hero-badge">Duty and GST included in every price</span>
          <span className="hero-badge">Ships across India</span>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      <div className="toolbar">
        <div className="search-field">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <nav className="category-nav">
          {categories.map((c) => (
            <button
              key={c}
              className={`category-pill ${activeCategory === c ? "active" : ""}`}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </button>
          ))}
        </nav>
      </div>

      {products.length > 0 && visible.length === 0 && (
        <p className="muted">No products match your search.</p>
      )}

      <div className="product-grid">
        {visible.map((p) => (
          <Link key={p.id} to={`/product/${p.id}`} className="product-card">
            <ProductThumb product={p} />
            <div className="product-card-body">
              <span className="product-origin">{p.origin_country} · {p.category}</span>
              <h3 className="product-name">{p.name}</h3>
              <span className="product-price">₹{Number(p.price_inr).toLocaleString("en-IN")}</span>
              {p.stock_quantity === 0 && <span className="stock-badge">Out of stock</span>}
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
    </div>
  );
}
