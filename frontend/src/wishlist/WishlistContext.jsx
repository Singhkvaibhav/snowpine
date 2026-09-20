import { createContext, useContext, useEffect, useState } from "react";
import { fetchWishlist, addToWishlist, removeFromWishlist } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const WishlistContext = createContext(null);

// Server-backed, not localStorage like the cart - a wishlist only means
// something if it's still there when the customer comes back later,
// possibly on a different device, which requires it to be tied to their
// account rather than the browser they happened to be using.
export function WishlistProvider({ children }) {
  const { customer } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) {
      setItems([]);
      return;
    }
    setLoading(true);
    fetchWishlist()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [customer]);

  const productIds = new Set(items.map((p) => p.id));

  function isSaved(productId) {
    return productIds.has(productId);
  }

  // Optimistic - updates local state immediately rather than waiting on
  // the round trip, since this is purely a convenience toggle and a
  // failed request just reverts it rather than blocking anything else
  // (unlike cart/checkout, nothing downstream depends on this succeeding).
  async function toggle(product) {
    if (!customer) return;
    if (isSaved(product.id)) {
      setItems((prev) => prev.filter((p) => p.id !== product.id));
      try {
        await removeFromWishlist(product.id);
      } catch {
        setItems((prev) => [product, ...prev]);
      }
    } else {
      setItems((prev) => [product, ...prev]);
      try {
        await addToWishlist(product.id);
      } catch {
        setItems((prev) => prev.filter((p) => p.id !== product.id));
      }
    }
  }

  return (
    <WishlistContext.Provider value={{ items, loading, isSaved, toggle }}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
