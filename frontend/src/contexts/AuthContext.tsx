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

function applyAuthResponse(res: AuthResponse, setUser: (user: User | null) => void) {
  if (res.access_token) {
    api.setToken(res.access_token);
  }
  if (res.user) {
    setUser(res.user);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => api.setToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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
