const REQUIRED = ['CLERK_SECRET_KEY', 'DATABASE_URL'] as const;

/** Fails fast and loudly at boot when required config is missing — a misconfigured CLERK_SECRET_KEY
 *  used to surface only as a generic 401 "invalid or expired session" on the first real request,
 *  indistinguishable from an actual auth problem (Important finding, final whole-branch review). */
export function validateRequiredEnv(env: NodeJS.ProcessEnv): void {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
}
