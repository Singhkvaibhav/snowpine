import { createContext, useContext, useEffect, useState } from "react";
import * as api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .fetchMe()
      .then(setCustomer)
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false));
  }, []);

  async function signup(fields) {
    const c = await api.signup(fields);
    setCustomer(c);
    return c;
  }

  async function login(fields) {
    const c = await api.login(fields);
    setCustomer(c);
    return c;
  }

  async function logout() {
    await api.logout();
    setCustomer(null);
  }

  return (
    <AuthContext.Provider value={{ customer, loading, signup, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
