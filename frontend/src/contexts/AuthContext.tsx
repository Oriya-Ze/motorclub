import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthResponse, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; full_name: string; password: string }) => Promise<AuthResponse>;
  confirmSignUp: (data: { email: string; code: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_CACHE_KEY = "motorclub_cached_user";

function readCachedUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: User | null) {
  if (user) sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(USER_CACHE_KEY);
}

function applyAuthResponse(res: AuthResponse, setUser: (user: User | null) => void) {
  if (res.access_token) {
    api.setToken(res.access_token);
  }
  if (res.user) {
    setUser(res.user);
    cacheUser(res.user);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedUser = readCachedUser();
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(() => Boolean(api.getToken()) && !cachedUser);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      cacheUser(null);
      setLoading(false);
      return;
    }

    api.me()
      .then((u) => {
        setUser(u);
        cacheUser(u);
      })
      .catch(() => {
        api.setToken(null);
        setUser(null);
        cacheUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    applyAuthResponse(res, setUser);
  };

  const register = async (data: { email: string; username: string; full_name: string; password: string }) => {
    return api.register(data);
  };

  const confirmSignUp = async (data: { email: string; code: string; password: string }) => {
    const res = await api.confirmSignUp(data);
    applyAuthResponse(res, setUser);
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    cacheUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, confirmSignUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
