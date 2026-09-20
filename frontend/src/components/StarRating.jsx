// Feather/Lucide's well-known "star" icon path - straight line segments
// only (no curves), so there's no risk of a hand-tuned bezier rendering
// as a blob, same reasoning as ProductThumb's category icons.
export const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z";

// Read-only display - a product card's rating badge, or a single
// review's own rating. Not interactive; see RatingInput for the
// clickable star-picker used in the review submission form.
export default function StarRating({ value, count }) {
  const rounded = Math.round(Number(value));
  const label = `Rated ${Number(value).toFixed(1)} out of 5${
    count != null ? ` from ${count} review${count === 1 ? "" : "s"}` : ""
  }`;
  return (
    <span className="star-rating" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" fill="currentColor" className={n <= rounded ? "star filled" : "star"} aria-hidden="true">
          <path d={STAR_PATH} />
        </svg>
      ))}
      {count != null && <span className="star-rating-count">({count})</span>}
    </span>
  );
}
