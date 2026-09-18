import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { CartProvider, useCart } from "./cart/CartContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Home from "./pages/Home.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import OrderConfirmation from "./pages/OrderConfirmation.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import MyOrders from "./pages/MyOrders.jsx";
import ShippingReturns from "./pages/legal/ShippingReturns.jsx";
import Terms from "./pages/legal/Terms.jsx";
import Privacy from "./pages/legal/Privacy.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminProducts from "./pages/admin/AdminProducts.jsx";
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
      <div>© {new Date().getFullYear()} Snowpine</div>
      <div>
        <Link to="/shipping-returns">Shipping &amp; Returns</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
              <Route path="/shipping-returns" element={<ShippingReturns />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/admin" element={<AdminOrders />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
