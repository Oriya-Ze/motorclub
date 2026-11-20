import { useQueryClient } from "@tanstack/react-query";
import { clearPendingGoogleSignup, readPendingGoogleSignup, savePendingGoogleSignup } from "@/lib/googleSignup";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthResponse, type OAuthConfig, type User } from "@/lib/api";
import { buildGoogleAuthorizeUrl } from "@/lib/cognitoOAuth";
import { prefetchAppData } from "@/lib/prefetch";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  completeOAuthLogin: (data: { code: string; redirect_uri: string }) => Promise<{ user: User | null; signupPending: boolean }>;
  completeGoogleSignup: (username: string) => Promise<void>;
  setSignedInUser: (user: User) => void;
  getOAuthConfig: () => Promise<OAuthConfig>;
  register: (data: {
    email: string;
    username: string;
    full_name: string;
    password: string;
    captcha_token?: string;
  }) => Promise<AuthResponse>;
  confirmSignUp: (data: { email: string; code: string; password: string }) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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
  api.applyAuthResponse(res);
  if (res.user) {
    setUser(res.user);
    cacheUser(res.user);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedUser = readCachedUser();
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(() => Boolean(api.getToken()) && !cachedUser);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      cacheUser(null);
      setLoading(false);
      return;
    }

    prefetchAppData(queryClient);
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
  }, [queryClient]);

  const login = async (email: string, password: string, captchaToken?: string) => {
    const res = await api.login({
      email,
      password,
      captcha_token: captchaToken,
    });
    applyAuthResponse(res, setUser);
  };

  const getOAuthConfig = async () => api.getOAuthConfig();

  const loginWithGoogle = async () => {
    const config = await api.getOAuthConfig();
    window.location.href = buildGoogleAuthorizeUrl(config);
  };

  const completeOAuthLogin = async (data: { code: string; redirect_uri: string }) => {
    const res = await api.oauthCallback(data);
    if (res.google_signup) {
      // New to MotorClub: nothing is saved until a username is chosen and the terms accepted.
      savePendingGoogleSignup(res.google_signup);
      return { user: null, signupPending: true };
    }
    clearPendingGoogleSignup();
    applyAuthResponse(res, setUser);
    return { user: res.user ?? null, signupPending: false };
  };

  const completeGoogleSignup = async (username: string) => {
    const pending = readPendingGoogleSignup();
    if (!pending) throw new Error("google_signup_expired");
    const res = await api.completeGoogleSignup({
      access_token: pending.access_token,
      id_token: pending.id_token,
      refresh_token: pending.refresh_token,
      expires_in: pending.expires_in,
      username,
      accept_terms: true,
    });
    clearPendingGoogleSignup();
    applyAuthResponse(res, setUser);
  };

  const setSignedInUser = (next: User) => {
    setUser(next);
    cacheUser(next);
  };

  const register = async (data: { email: string; username: string; full_name: string; password: string }) => {
    return api.register(data);
  };

  const confirmSignUp = async (data: { email: string; code: string; password: string }) => {
    const res = await api.confirmSignUp(data);
    applyAuthResponse(res, setUser);
  };

  const resendConfirmation = async (email: string) => {
    await api.resendConfirmation(email);
  };

  const logout = () => {
    void api.logoutSession();
    setUser(null);
    cacheUser(null);
  };

  const refreshUser = async () => {
    const u = await api.me();
    setUser(u);
    cacheUser(u);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        completeOAuthLogin,
        completeGoogleSignup,
        setSignedInUser,
        getOAuthConfig,
        register,
        confirmSignUp,
        resendConfirmation,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
