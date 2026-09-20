import { NavLink } from "react-router-dom";

// Was five copies of the same plain-text link line, one hand-duplicated
// per admin page - easy to drift out of sync (a new page added to one
// copy and forgotten in the others). One shared component, `end` on the
// Orders link only since /admin is also the prefix every other admin
// route starts with.
const LINKS = [
  { to: "/admin", label: "Orders", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/sales", label: "Sales overview" },
  { to: "/admin/stock-activity", label: "Stock activity" },
  { to: "/admin/discount-codes", label: "Discount codes" },
];

export default function AdminNav() {
  return (
    <nav className="admin-nav">
      {LINKS.map(({ to, label, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
