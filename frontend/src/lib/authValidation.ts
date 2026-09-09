export interface AuthFormDraft {
  mode: "login" | "register" | "confirm";
  email: string;
  password: string;
  full_name: string;
  username: string;
  code: string;
  agree: boolean;
}

const STORAGE_KEY = "motorclub_auth_draft";

export function loadAuthDraft(): AuthFormDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthFormDraft;
  } catch {
    return null;
  }
}

export function saveAuthDraft(draft: AuthFormDraft): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearAuthDraft(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.]{2,29}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "support", "help", "motorclub", "official",
  "system", "api", "www", "root", "null", "undefined", "moderator", "staff",
]);

export function validateEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (!value) return "authValidation.emailRequired";
  if (!EMAIL_PATTERN.test(value)) return "authValidation.invalidEmail";
  return null;
}

export function validatePasswordForLogin(password: string): string | null {
  if (!password) return "authValidation.passwordRequired";
  if (password.length < 8) return "authValidation.passwordTooShort";
  if (password.length > 128) return "authValidation.passwordTooLong";
  if (!/[A-Za-z]/.test(password)) return "authValidation.passwordNeedsLetter";
  if (!/\d/.test(password)) return "authValidation.passwordNeedsNumber";
  return null;
}

export function validatePasswordForRegister(
  password: string,
  email: string,
  username: string,
): string | null {
  const base = validatePasswordForLogin(password);
  if (base) return base;
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    return "authValidation.passwordContainsUsername";
  }
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 3 && password.toLowerCase().includes(local)) {
    return "authValidation.passwordContainsEmail";
  }
  return null;
}

export function validateUsername(username: string): string | null {
  const value = username.trim();
  if (!value) return "authValidation.usernameRequired";
  if (value.length < 3) return "authValidation.usernameTooShort";
  if (value.length > 30) return "authValidation.usernameTooLong";
  if (!USERNAME_PATTERN.test(value)) return "authValidation.usernameInvalid";
  if (value.endsWith(".") || value.endsWith("_")) return "authValidation.usernameInvalidEnd";
  if (/(\.\.|__|\._|_\.)/.test(value)) return "authValidation.usernameInvalidSequence";
  if (RESERVED_USERNAMES.has(value.toLowerCase())) return "authValidation.usernameReserved";
  return null;
}

export function validateFullName(fullName: string): string | null {
  const value = fullName.trim();
  if (value.length < 2) return "authValidation.fullNameTooShort";
  if (value.length > 255) return "authValidation.fullNameTooLong";
  return null;
}

export function validateLoginForm(email: string, password: string): string | null {
  return validateEmail(email) ?? validatePasswordForLogin(password);
}

export function validateRegisterForm(data: {
  email: string;
  password: string;
  full_name: string;
  username: string;
}): string | null {
  return (
    validateFullName(data.full_name)
    ?? validateUsername(data.username)
    ?? validateEmail(data.email)
    ?? validatePasswordForRegister(data.password, data.email, data.username)
  );
}

export function validateConfirmForm(code: string): string | null {
  const value = code.trim();
  if (!value) return "authValidation.codeRequired";
  if (!/^\d{4,10}$/.test(value)) return "authValidation.codeInvalid";
  return null;
}
