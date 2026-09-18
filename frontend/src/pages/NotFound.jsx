import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div>
      <h2>Page not found</h2>
      <p className="muted">The page you're looking for doesn't exist.</p>
      <Link to="/">Back to shop</Link>
    </div>
  );
}
