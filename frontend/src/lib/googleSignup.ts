/**
 * A first Google sign-in that still has to choose a username and accept the terms. Nothing is saved on the server
 * until that is done, so the tokens wait here (this tab only) and are not a session yet.
 */
export interface GoogleSignupPending {
  access_token: string;
  id_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  suggested_username: string;
  full_name: string;
}

const KEY = "motorclub_google_signup";

export function savePendingGoogleSignup(pending: GoogleSignupPending) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // storage blocked: the welcome page will send the person back to sign in
  }
}

export function readPendingGoogleSignup(): GoogleSignupPending | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as GoogleSignupPending;
    return value?.access_token && value?.id_token ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingGoogleSignup() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
