const LOCAL_FALLBACK_ORIGIN = 'http://localhost:3000';

function isHttpUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export function getAppOrigin(requestOrigin: string | null) {
  const configuredOrigin = process.env.APP_URL?.trim();

  // Browser requests should use the domain the user is currently visiting.
  // APP_URL remains the fallback for calls that do not include an Origin header.
  if (isHttpUrl(requestOrigin)) return requestOrigin;
  if (isHttpUrl(configuredOrigin)) return configuredOrigin;

  return LOCAL_FALLBACK_ORIGIN;
}

export function getAuthCallbackUrl({
  origin,
  next,
}: {
  origin: string | null;
  next?: '/reset-password';
}) {
  const callbackUrl = new URL('/auth/callback', getAppOrigin(origin));
  if (next) callbackUrl.searchParams.set('next', next);

  return callbackUrl.toString();
}
