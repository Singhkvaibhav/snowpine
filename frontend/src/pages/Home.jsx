import { useEffect, useState } from "react";
import { fetchProducts } from "../api/client";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts().then(setProducts).catch((e) => setError(e.message));
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Snowpine</h1>
      <p>Nordic and European products, delivered in India.</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1.5rem" }}>
        {products.map((p) => (
          <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem" }}>
            <h3>{p.name}</h3>
            <p style={{ fontSize: "0.85rem", color: "#666" }}>{p.origin_country} · {p.category}</p>
            <p>{p.description}</p>
            <strong>₹{Number(p.price_inr).toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </main>
  );
}
