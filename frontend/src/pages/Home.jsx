import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchProducts } from "../api/client";
import { useCart } from "../cart/CartContext";
import ProductThumb from "../components/ProductThumb";
import WishlistButton from "../components/WishlistButton";
import StarRating from "../components/StarRating";
import usePageMeta from "../hooks/usePageMeta";

const LOW_STOCK_HINT_THRESHOLD = 5;

export default function Home() {
  usePageMeta();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  // Seeded from ?category= (e.g. a product detail page's breadcrumb link
  // back to its category) so that link actually lands pre-filtered,
  // rather than just dumping the visitor back on an unfiltered catalog.
  const [activeCategory, setActiveCategory] = useState(() => searchParams.get("category") || "All");
  const [country, setCountry] = useState("All");
  const [sort, setSort] = useState("default");
  const [search, setSearch] = useState("");
  const { addItem } = useCart();

  useEffect(() => {
    fetchProducts().then(setProducts).catch((e) => setError(e.message));
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const countries = useMemo(() => {
    const set = new Set(products.map((p) => p.origin_country));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const visible = products
    .filter((p) => {
      const inCategory = activeCategory === "All" || p.category === activeCategory;
      const inCountry = country === "All" || p.origin_country === country;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.origin_country.toLowerCase().includes(query);
      return inCategory && inCountry && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === "price-asc") return Number(a.price_inr) - Number(b.price_inr);
      if (sort === "price-desc") return Number(b.price_inr) - Number(a.price_inr);
      return 0; // "default" - keep the server's order
    });

  return (
    <div>
      <section className="hero">
        <div className="hero-content">
          <span className="hero-eyebrow">Sweden · Finland · Denmark · Norway</span>
          <h1>Nordic craftsmanship, delivered to your door</h1>
          <p>Curated baby gear, home design, and skincare from the Nordics - authentic, and ready to ship across India.</p>
          <div className="hero-actions">
            <a href="#shop" className="btn">Shop the collection</a>
            <Link to="/shipping-returns" className="hero-link">Shipping &amp; returns policy →</Link>
          </div>
          <div className="hero-badges">
            <span className="hero-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Curated from trusted Nordic brands
            </span>
            <span className="hero-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" /></svg>
              Duty and GST included in every price
            </span>
            <span className="hero-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="14" height="11" rx="1" /><path d="M15 10h4l3 3v4h-7z" /><circle cx="6" cy="19" r="1.6" /><circle cx="17.5" cy="19" r="1.6" /></svg>
              Ships across India, 5-10 business days
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <svg viewBox="0 0 200 200" fill="none">
            <polygon points="0,170 55,70 100,140 130,90 200,170" fill="var(--accent)" opacity="0.16" />
            <polygon points="30,170 90,95 140,170" fill="var(--accent)" opacity="0.22" />
            <polygon points="110,170 160,80 200,170" fill="var(--accent-dark)" opacity="0.18" />
            <circle cx="152" cy="46" r="16" fill="var(--warm)" opacity="0.5" />
            <g stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.55">
              <line x1="40" y1="34" x2="40" y2="54" />
              <line x1="30" y1="44" x2="50" y2="44" />
              <line x1="33" y1="37" x2="47" y2="51" />
              <line x1="47" y1="37" x2="33" y2="51" />
            </g>
          </svg>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      <div className="toolbar" id="shop">
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

        <div className="filter-row">
          <label className="filter-select">
            Origin
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="filter-select">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="default">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
        </div>
      </div>

      {products.length > 0 && visible.length === 0 && (
        <p className="muted">No products match your search.</p>
      )}

      <div className="product-grid">
        {visible.map((p) => (
          <Link key={p.id} to={`/product/${p.id}`} className="product-card">
            <div className="product-thumb-wrap">
              <ProductThumb product={p} />
              <WishlistButton product={p} />
            </div>
            <div className="product-card-body">
              <span className="product-origin">{p.origin_country} · {p.category}</span>
              <h3 className="product-name">{p.name}</h3>
              {Number(p.review_count) > 0 && (
                <div className="product-card-rating">
                  <StarRating value={p.avg_rating} count={Number(p.review_count)} />
                </div>
              )}
              <span className="product-price">₹{Number(p.price_inr).toLocaleString("en-IN")}</span>
              {p.stock_quantity === 0 ? (
                <span className="stock-badge">Out of stock</span>
              ) : p.stock_quantity <= LOW_STOCK_HINT_THRESHOLD ? (
                <span className="stock-badge">Only {p.stock_quantity} left</span>
              ) : (
                <span className="muted" style={{ fontSize: "0.75rem" }}>In stock · ships in 5-10 days</span>
              )}
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
