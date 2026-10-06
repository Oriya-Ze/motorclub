/**
 * Input filters for fields that hold numbers. Applied on change, so typing or pasting anything else
 * (letters, dashes in a phone number, "e" in a number field) simply does not appear.
 */

/** Digits only, cut to maxLength when given. "050-123 4567" becomes "0501234567". */
export function digitsOnly(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, "");
  return maxLength ? digits.slice(0, maxLength) : digits;
}

/** A price: digits with at most one decimal point and two decimals. */
export function decimalOnly(value: string): string {
  const [whole, ...rest] = value.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

export const PHONE_MAX_DIGITS = 15;
export const YEAR_DIGITS = 4;
export const CODE_DIGITS = 6;
/** Israeli company and business numbers (ח.פ / ע.מ) are nine digits. */
export const REGISTRATION_DIGITS = 9;
