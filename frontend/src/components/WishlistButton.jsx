import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWishlist } from "../wishlist/WishlistContext";

// Icon-only circular button by default (overlaid on a product card's
// thumbnail); pass showLabel for the labeled secondary-button variant
// used on the product detail page.
export default function WishlistButton({ product, showLabel = false, className = "" }) {
  const { customer } = useAuth();
  const { isSaved, toggle } = useWishlist();
  const navigate = useNavigate();
  const saved = Boolean(customer) && isSaved(product.id);

  return (
    <button
      type="button"
      className={`wishlist-btn ${showLabel ? "with-label" : ""} ${saved ? "saved" : ""} ${className}`}
      aria-label={saved ? `Remove ${product.name} from your wishlist` : `Save ${product.name} to your wishlist`}
      aria-pressed={saved}
      onClick={(e) => {
        // Stops the surrounding product-card <Link> from navigating when
        // this sits on top of a card thumbnail.
        e.preventDefault();
        e.stopPropagation();
        if (!customer) {
          navigate("/login");
          return;
        }
        toggle(product);
      }}
    >
      <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {showLabel && <span>{saved ? "Saved" : "Save for later"}</span>}
    </button>
  );
}
