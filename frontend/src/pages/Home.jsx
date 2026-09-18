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
      <p className="muted">Nordic and European products, delivered in India.</p>

      {error && <p className="error-text">{error}</p>}

      <input
        type="search"
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", maxWidth: 320, marginBottom: "1rem", display: "block" }}
      />

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
