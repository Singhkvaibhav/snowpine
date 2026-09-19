export async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Failed to load products");
  return res.json();
}

export async function fetchProduct(id) {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error("Failed to load product");
  return res.json();
}

export async function placeOrder(order) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to place order");
  return data;
}

export async function verifyPayment(orderId, payload) {
  const res = await fetch(`/api/orders/${orderId}/verify-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Payment verification failed");
  return data;
}

export async function fetchOrder(id, token) {
  const res = await fetch(`/api/orders/${id}?token=${encodeURIComponent(token || "")}`);
  if (!res.ok) throw new Error("Order not found - check the link from your confirmation email");
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

export async function signup(fields) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to sign up");
  return data.customer;
}

export async function login(fields) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to log in");
  return data.customer;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function fetchMe() {
  const res = await fetch("/api/auth/me");
  if (!res.ok) throw new Error("Failed to check login status");
  return (await res.json()).customer;
}

export async function fetchMyOrders() {
  const res = await fetch("/api/orders/mine");
  if (!res.ok) throw new Error("Failed to load your orders");
  return res.json();
}

export async function adminFetchOrders(token) {
  const res = await fetch("/api/admin/orders", { headers: { "x-admin-token": token } });
  if (!res.ok) throw new Error(res.status === 401 ? "Invalid admin token" : "Failed to load orders");
  return res.json();
}

export async function adminFetchSalesOverview(token) {
  const res = await fetch("/api/admin/sales-overview", { headers: { "x-admin-token": token } });
  if (!res.ok) throw new Error(res.status === 401 ? "Invalid admin token" : "Failed to load sales overview");
  return res.json();
}

export async function adminUpdateOrderStatus(token, orderId, status) {
  const res = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update order");
  return data;
}

async function adminOrderAction(token, orderId, action) {
  const res = await fetch(`/api/admin/orders/${orderId}/${action}`, {
    method: "POST",
    headers: { "x-admin-token": token },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to ${action} order`);
  return data;
}

export const adminRequestReturn = (token, orderId) => adminOrderAction(token, orderId, "return");
export const adminMarkReturned = (token, orderId) => adminOrderAction(token, orderId, "restock");
export const adminRefundOrder = (token, orderId) => adminOrderAction(token, orderId, "refund");

export async function adminFetchProducts(token) {
  const res = await fetch("/api/admin/products", { headers: { "x-admin-token": token } });
  if (!res.ok) throw new Error(res.status === 401 ? "Invalid admin token" : "Failed to load products");
  return res.json();
}

export async function adminUpdateProduct(token, productId, fields) {
  const res = await fetch(`/api/admin/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update product");
  return data;
}

export async function adminCreateProduct(token, fields) {
  const res = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create product");
  return data;
}

export async function adminFetchDiscountCodes(token) {
  const res = await fetch("/api/admin/discount-codes", { headers: { "x-admin-token": token } });
  if (!res.ok) throw new Error(res.status === 401 ? "Invalid admin token" : "Failed to load discount codes");
  return res.json();
}

export async function adminCreateDiscountCode(token, fields) {
  const res = await fetch("/api/admin/discount-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create discount code");
  return data;
}

export async function adminUpdateDiscountCode(token, id, fields) {
  const res = await fetch(`/api/admin/discount-codes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update discount code");
  return data;
}

export async function adminFetchLowStock(token) {
  const res = await fetch("/api/admin/products/low-stock", { headers: { "x-admin-token": token } });
  if (!res.ok) throw new Error("Failed to load low-stock products");
  return res.json();
}

export async function adminFetchStockMovements(token, productId) {
  const url = productId ? `/api/admin/stock-movements?productId=${productId}` : "/api/admin/stock-movements";
  const res = await fetch(url, { headers: { "x-admin-token": token } });
  if (!res.ok) throw new Error("Failed to load stock activity");
  return res.json();
}
