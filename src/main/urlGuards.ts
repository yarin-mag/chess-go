const PROTOCOL = 'b-chess';

/** True only for this app's real auth-callback URL — the literal `b-chess://auth-callback` host, never
 *  any other `b-chess://` path. Any local process or web page can invoke this app's custom protocol;
 *  without this check, `handleProtocolUrl` would forward whatever it was handed straight to the
 *  renderer as if Clerk had sent it (Important finding, final whole-branch review). */
export function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${PROTOCOL}:` && parsed.hostname === 'auth-callback';
  } catch {
    return false;
  }
}

/** True only for an https: URL — the one thing the renderer should ever be able to hand to the OS's
 *  default browser via the 'open-external' IPC channel. `shell.openExternal` will happily act on
 *  file:// and other launchable schemes too; that was harmless while the renderer loaded no remote
 *  code, but this branch makes it load Clerk's third-party script (Important finding, final review). */
export function isAllowedExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
