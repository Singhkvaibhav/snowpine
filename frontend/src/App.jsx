import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { CartProvider, useCart } from "./cart/CartContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { WishlistProvider } from "./wishlist/WishlistContext";
import Home from "./pages/Home.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import OrderConfirmation from "./pages/OrderConfirmation.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import MyOrders from "./pages/MyOrders.jsx";
import MyWishlist from "./pages/MyWishlist.jsx";
import ShippingReturns from "./pages/legal/ShippingReturns.jsx";
import Terms from "./pages/legal/Terms.jsx";
import Privacy from "./pages/legal/Privacy.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminProducts from "./pages/admin/AdminProducts.jsx";
import AdminStockActivity from "./pages/admin/AdminStockActivity.jsx";
import AdminSalesOverview from "./pages/admin/AdminSalesOverview.jsx";
import AdminDiscountCodes from "./pages/admin/AdminDiscountCodes.jsx";
import NotFound from "./pages/NotFound.jsx";
import "./styles.css";

function Header() {
  const { itemCount } = useCart();
  const { customer, loading, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <strong>Snowpine</strong>
        <span>Nordic goods, delivered in India</span>
      </Link>
      <nav className="nav-links">
        {!loading && (
          customer ? (
            <>
              <Link to="/account/wishlist">Wishlist</Link>
              <Link to="/account/orders">{customer.name}</Link>
              <button
                className="btn-secondary btn"
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )
        )}
        <Link to="/cart" className="cart-link">Cart ({itemCount})</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <strong>Snowpine</strong>
          <p className="muted">Nordic baby gear, home design, and skincare - authentic, and shipped across India.</p>
        </div>
        <div className="site-footer-col">
          <span className="site-footer-heading">Shop</span>
          <Link to="/">All products</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/account/wishlist">Wishlist</Link>
          <Link to="/account/orders">Your orders</Link>
        </div>
        <div className="site-footer-col">
          <span className="site-footer-heading">Help</span>
          <Link to="/shipping-returns">Shipping &amp; Returns</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Snowpine</span>
        <span>Made with care · Shipped from India</span>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WishlistProvider>
        <CartProvider>
          <div className="layout">
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order/:id" element={<OrderConfirmation />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/account/orders" element={<MyOrders />} />
              <Route path="/account/wishlist" element={<MyWishlist />} />
              <Route path="/shipping-returns" element={<ShippingReturns />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/admin" element={<AdminOrders />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/stock-activity" element={<AdminStockActivity />} />
              <Route path="/admin/sales" element={<AdminSalesOverview />} />
              <Route path="/admin/discount-codes" element={<AdminDiscountCodes />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer />
          </div>
        </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
