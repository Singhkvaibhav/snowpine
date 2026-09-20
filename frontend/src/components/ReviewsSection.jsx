import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchProductReviews, fetchMyReview, submitReview, deleteReview } from "../api/client";
import StarRating from "./StarRating";
import RatingInput from "./RatingInput";

export default function ReviewsSection({ productId, avgRating, reviewCount }) {
  const { customer } = useAuth();
  const [reviews, setReviews] = useState([]);
  // {eligible, review} - null while unresolved/logged out, so the form
  // only ever renders once we actually know the customer can use it.
  const [myStatus, setMyStatus] = useState(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProductReviews(productId).then(setReviews).catch(() => {});
  }, [productId]);

  useEffect(() => {
    setMyStatus(null);
    setRating(0);
    setBody("");
    if (!customer) return;
    fetchMyReview(productId).then((status) => {
      setMyStatus(status);
      if (status.review) {
        setRating(status.review.rating);
        setBody(status.review.body);
      }
    });
  }, [customer, productId]);

  async function refresh() {
    const [freshReviews, freshStatus] = await Promise.all([fetchProductReviews(productId), fetchMyReview(productId)]);
    setReviews(freshReviews);
    setMyStatus(freshStatus);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(productId, { rating, body });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteReview(productId);
      setRating(0);
      setBody("");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="reviews-section">
      <h2>Reviews</h2>
      {reviewCount > 0 ? (
        <div className="reviews-summary">
          <StarRating value={avgRating} count={reviewCount} />
        </div>
      ) : (
        <p className="muted">No reviews yet.</p>
      )}

      {error && <p className="error-text">{error}</p>}

      {!customer && (
        <p className="muted">
          <Link to="/login">Log in</Link> to write a review.
        </p>
      )}

      {customer && myStatus && !myStatus.eligible && (
        <p className="muted">You can review this item once your order for it has been delivered.</p>
      )}

      {customer && myStatus?.eligible && (
        <form className="review-form" onSubmit={handleSubmit}>
          <strong>{myStatus.review ? "Edit your review" : "Write a review"}</strong>
          <div style={{ margin: "0.6rem 0" }}>
            <RatingInput value={rating} onChange={setRating} />
          </div>
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you think of this product?"
          />
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn" type="submit" disabled={submitting || rating === 0}>
              {submitting ? "Saving..." : myStatus.review ? "Update review" : "Submit review"}
            </button>
            {myStatus.review && (
              <button type="button" className="btn-secondary btn" onClick={handleDelete} disabled={submitting}>
                Delete
              </button>
            )}
          </div>
        </form>
      )}

      {reviews.length > 0 && (
        <div className="review-list">
          {reviews.map((r) => (
            <div className="review" key={r.id}>
              <div className="review-meta">
                <StarRating value={r.rating} />
                <span className="review-author">{r.customer_name}</span>
                <span className="review-date">{new Date(r.created_at).toLocaleDateString("en-IN")}</span>
              </div>
              <p className="review-body">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
