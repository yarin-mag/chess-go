export interface ParsedAuthCallback {
  ticket: string;
  state: string | null;
}

/** Parses the b-chess://auth-callback URL Clerk's native redirect hands back. `ticket` matches Clerk's
 *  documented ticket-strategy param name; `__clerk_ticket` is checked too since that's the name Clerk
 *  uses for its own invitation/email-link redirects, in case the native-redirect flow reuses it
 *  (verified live against a real app in Task 14). `state` is this app's own CSRF nonce (Important
 *  finding, final whole-branch review) — not a Clerk param, round-tripped through redirectUrl's query
 *  string. Returns null instead of throwing on a malformed URL or a URL with no ticket at all. */
export function parseAuthCallback(url: string): ParsedAuthCallback | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const ticket = parsed.searchParams.get('ticket') ?? parsed.searchParams.get('__clerk_ticket');
  if (!ticket) return null;
  return { ticket, state: parsed.searchParams.get('state') };
}
