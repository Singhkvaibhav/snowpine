import { STAR_PATH } from "./StarRating";

// The clickable star-picker for the review submission form - StarRating
// is the read-only display used everywhere else (product cards, listed
// reviews).
export default function RatingInput({ value, onChange }) {
  return (
    <div className="rating-input" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={n <= value ? "star filled" : "star"}
          onClick={() => onChange(n)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d={STAR_PATH} />
          </svg>
        </button>
      ))}
    </div>
  );
}
