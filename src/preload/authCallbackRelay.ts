/** Buffers a cold-start auth-callback URL until the renderer's `onAuthCallback` actually subscribes.
 *  On a genuine cold start, main/index.ts delivers the protocol URL on 'did-finish-load', which fires
 *  long before AuthGateScreen can possibly have mounted and called onAuthCallback (that requires
 *  decideGate() === 'showSignIn', which requires Clerk to have loaded over the network first). Without
 *  this buffer, that IPC message is sent into a renderer with zero listeners and is silently dropped
 *  (Important finding, final whole-branch review). The warm path (app already running, user clicks the
 *  sign-in button) is unaffected — a callback is already subscribed by the time a URL ever arrives. */
export class AuthCallbackRelay {
  private pendingUrl: string | null = null;
  private currentCallback: ((url: string) => void) | null = null;

  /** Called for every 'auth-callback' IPC message the main process sends. */
  deliver(url: string): void {
    if (this.currentCallback) this.currentCallback(url);
    else this.pendingUrl = url;
  }

  /** Called once by the renderer's onAuthCallback. Replays a buffered URL immediately, if any;
   *  otherwise delivers whatever arrives next. Returns an unsubscribe function. */
  subscribe(callback: (url: string) => void): () => void {
    this.currentCallback = callback;
    if (this.pendingUrl) {
      const url = this.pendingUrl;
      this.pendingUrl = null;
      callback(url);
    }
    return () => {
      if (this.currentCallback === callback) this.currentCallback = null;
    };
  }
}
