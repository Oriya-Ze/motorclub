import i18n, { resolveAppLanguage } from "@/i18n";

const EXACT_ERROR_KEYS: Record<string, string> = {
  Unauthorized: "apiErrors.unauthorized",
  "Request failed": "apiErrors.requestFailed",
  "Not authenticated": "apiErrors.notAuthenticated",
  "Invalid email or password": "apiErrors.invalidCredentials",
  "Email not registered": "apiErrors.emailNotRegistered",
  "Captcha verification required": "apiErrors.captchaRequired",
  "Captcha verification failed": "apiErrors.captchaFailed",
  "Captcha verification unavailable": "apiErrors.captchaUnavailable",
  "Invalid email address": "apiErrors.invalidEmail",
  "Password is required": "apiErrors.passwordRequired",
  "Password is too long": "apiErrors.passwordTooLong",
  "Username must be at most 30 characters": "apiErrors.usernameTooLong",
  "Username is reserved": "apiErrors.usernameReserved",
  "Username must start with a letter and contain only letters, numbers, dots, or underscores":
    "apiErrors.usernameInvalid",
  "Username cannot end with a dot or underscore": "apiErrors.usernameInvalid",
  "Username cannot contain consecutive special characters": "apiErrors.usernameInvalid",
  "Full name is too long": "apiErrors.fullNameTooLong",
  "Invalid token": "apiErrors.invalidToken",
  "Invalid Cognito token": "apiErrors.invalidToken",
  "Invalid Cognito token type": "apiErrors.invalidToken",
  "Invalid Cognito client": "apiErrors.invalidToken",
  "Invalid auth response": "apiErrors.invalidToken",
  "User not found": "apiErrors.userNotFound",
  "Email already registered": "apiErrors.emailAlreadyRegistered",
  "Username already taken": "apiErrors.usernameAlreadyTaken",
  "Invalid verification code": "apiErrors.invalidVerificationCode",
  "Verification code expired": "apiErrors.verificationCodeExpired",
  "Could not send verification email": "apiErrors.couldNotSendVerificationEmail",
  "Could not send password reset email": "apiErrors.couldNotSendPasswordResetEmail",
  "Could not create account": "apiErrors.couldNotCreateAccount",
  "Email not verified. Enter the confirmation code sent to your email.": "apiErrors.emailNotVerified",
  "Account is disabled": "apiErrors.accountDisabled",
  "Too many requests. Please try again later.": "apiErrors.tooManyRequests",
  "Password must be at least 8 characters": "apiErrors.passwordTooShort",
  "Password must contain at least one letter": "apiErrors.passwordNeedsLetter",
  "Password must contain at least one number": "apiErrors.passwordNeedsNumber",
  "Password cannot contain username": "apiErrors.passwordContainsUsername",
  "Password cannot contain email": "apiErrors.passwordContainsEmail",
  "Full name must be at least 2 characters": "apiErrors.fullNameTooShort",
  "Username must be at least 3 characters": "apiErrors.usernameTooShort",
  "Username contains invalid characters": "apiErrors.usernameInvalid",
  "Username cannot be changed": "apiErrors.usernameLocked",
  "Current password is incorrect": "apiErrors.currentPasswordIncorrect",
  "Access token required to change password": "apiErrors.accessTokenRequired",
  "Account confirmation is only available with Cognito auth": "apiErrors.cognitoOnly",
  "OAuth sign-in is not configured": "apiErrors.oauthNotConfigured",
  "OAuth sign-in failed": "apiErrors.oauthFailed",
  "Google sign-in is not configured": "apiErrors.oauthNotConfigured",
  "Password reset via code is only available with Cognito auth provider": "apiErrors.cognitoOnly",
  "If the email exists, a verification code was sent to your email": "apiErrors.resetEmailSentGeneric",
  "If the email is pending verification, a new code was sent": "apiErrors.resendConfirmationGeneric",
  "Password reset successfully": "apiErrors.passwordResetSuccess",
  "Post not found": "apiErrors.postNotFound",
  "You can only delete your own posts": "apiErrors.postDeleteForbidden",
  "Group not found": "apiErrors.groupNotFound",
  "Join the group to view members": "apiErrors.groupMembersForbidden",
  "You are not a member of this group": "apiErrors.notGroupMember",
  "Group owners cannot leave. Delete the group instead.": "apiErrors.groupOwnerCannotLeave",
  "Only the group owner can delete the group": "apiErrors.groupDeleteForbidden",
  "Only group managers can remove members": "apiErrors.groupRemoveForbidden",
  "Only group managers can view join requests": "apiErrors.groupJoinRequestsForbidden",
  "Only group managers can approve join requests": "apiErrors.groupJoinApproveForbidden",
  "Only group managers can reject join requests": "apiErrors.groupJoinRejectForbidden",
  "Follow request not found": "apiErrors.followRequestNotFound",
  "Use the leave endpoint to leave the group": "apiErrors.useLeaveEndpoint",
  "Member not found": "apiErrors.memberNotFound",
  "Cannot remove the group owner": "apiErrors.cannotRemoveOwner",
  "Invalid business category": "apiErrors.invalidBusinessCategory",
  "A business upgrade request is already pending review": "apiErrors.businessUpgradePendingExists",
  "Account is already a business account": "apiErrors.alreadyBusinessAccount",
  "Admin access required": "apiErrors.adminRequired",
  "Request is not pending": "apiErrors.requestNotPending",
  "Only the group owner can change member roles": "apiErrors.groupRoleForbidden",
  "Cannot change the owner's role": "apiErrors.cannotChangeOwnerRole",
  "Invalid role": "apiErrors.invalidRole",
  "Join the group to view messages": "apiErrors.groupMessagesForbidden",
  "Join the group to send messages": "apiErrors.groupSendForbidden",
  "Vehicle not found": "apiErrors.vehicleNotFound",
  "Vehicle catalog unavailable": "apiErrors.vehicleCatalogUnavailable",
  "Event not found": "apiErrors.eventNotFound",
  "Event is full": "apiErrors.eventFull",
  "You are not registered for this event": "apiErrors.eventNotRegistered",
  "Cannot message yourself": "apiErrors.cannotMessageSelf",
  "Conversation not found": "apiErrors.conversationNotFound",
  "Cannot follow yourself": "apiErrors.cannotFollowSelf",
  "Cannot review your own business": "apiErrors.cannotReviewOwnBusiness",
  "Unsupported file type": "apiErrors.unsupportedFileType",
  "Unsupported file extension": "apiErrors.unsupportedFileExtension",
  "File extension does not match content type": "apiErrors.fileExtensionMismatch",
  "Empty file": "apiErrors.emptyFile",
  "size_bytes must be positive": "apiErrors.invalidFileSize",
  "Unable to create upload URL": "apiErrors.uploadUrlFailed",
  "Storage key does not belong to user": "apiErrors.storageKeyForbidden",
  "Invalid storage key": "apiErrors.invalidStorageKey",
  "Invalid storage key format": "apiErrors.invalidStorageKey",
  'קוד אימות נשלח לדוא"ל שלך. החשבון ייווצר רק לאחר האימות.': "apiErrors.confirmEmailSentDetail",
};

const PATTERNS: Array<{ pattern: RegExp; key: string; args?: (match: RegExpMatchArray) => Record<string, string | number> }> = [
  {
    pattern: /too many requests/i,
    key: "apiErrors.tooManyRequests",
  },
  {
    pattern: /^File too large \(max (\d+)MB\)$/,
    key: "apiErrors.fileTooLarge",
    args: (match) => ({ max: match[1] }),
  },
  {
    pattern: /^Unsupported purpose: (.+)$/,
    key: "apiErrors.unsupportedPurpose",
    args: (match) => ({ purpose: match[1] }),
  },
  {
    pattern: /value is not a valid email address/i,
    key: "apiErrors.invalidEmail",
  },
  {
    pattern: /String should have at least (\d+) characters/i,
    key: "apiErrors.stringTooShort",
    args: (match) => ({ min: match[1] }),
  },
];

function normalizeErrorMessage(message: string): string {
  return message.trim().replace(/^[\s.,:;!?]+/, "").replace(/\s+/g, " ");
}

function tError(key: string, options?: Record<string, string | number>): string {
  return i18n.t(key, { ...options, lng: resolveAppLanguage() });
}

function translatePart(message: string): string {
  const trimmed = normalizeErrorMessage(message);
  if (!trimmed) return tError("error");

  const exactKey = EXACT_ERROR_KEYS[trimmed];
  if (exactKey) return tError(exactKey);

  for (const { pattern, key, args } of PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return tError(key, args?.(match) ?? {});
    }
  }

  return tError("error");
}

export function translateRateLimitError(): string {
  return tError("apiErrors.tooManyRequests");
}

export function translateApiError(message: string): string {
  if (!message.trim()) return tError("error");

  return message
    .split(",")
    .map((part) => translatePart(part))
    .join(", ");
}
