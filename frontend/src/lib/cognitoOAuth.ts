export interface OAuthConfig {
  google_enabled: boolean;
  client_id?: string | null;
  cognito_domain?: string | null;
  region?: string | null;
}

export function oauthRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

export function buildGoogleAuthorizeUrl(config: OAuthConfig): string {
  if (!config.google_enabled || !config.client_id || !config.cognito_domain || !config.region) {
    throw new Error("Google sign-in is not configured");
  }

  const params = new URLSearchParams({
    client_id: config.client_id,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: oauthRedirectUri(),
    identity_provider: "Google",
  });

  return `https://${config.cognito_domain}.auth.${config.region}.amazoncognito.com/oauth2/authorize?${params.toString()}`;
}
