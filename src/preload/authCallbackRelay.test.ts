import { describe, expect, it, vi } from 'vitest';
import { AuthCallbackRelay } from './authCallbackRelay';

// Important finding (final whole-branch review): on a genuine cold start, the main process delivers
// the protocol URL on 'did-finish-load', which fires long before AuthGateScreen can possibly have
// mounted and called onAuthCallback (that requires decideGate() === 'showSignIn', which requires Clerk
// to have loaded over the network first). Without buffering, that IPC message is sent into a renderer
// with zero listeners and is silently dropped.
describe('AuthCallbackRelay', () => {
  it('delivers immediately to an already-subscribed callback', () => {
    const relay = new AuthCallbackRelay();
    const callback = vi.fn();
    relay.subscribe(callback);
    relay.deliver('b-chess://auth-callback?ticket=abc');
    expect(callback).toHaveBeenCalledWith('b-chess://auth-callback?ticket=abc');
  });

  it('buffers a URL delivered before anyone has subscribed, and replays it on first subscribe', () => {
    const relay = new AuthCallbackRelay();
    relay.deliver('b-chess://auth-callback?ticket=cold-start');
    const callback = vi.fn();
    relay.subscribe(callback);
    expect(callback).toHaveBeenCalledWith('b-chess://auth-callback?ticket=cold-start');
  });

  it('does not replay a buffered URL twice', () => {
    const relay = new AuthCallbackRelay();
    relay.deliver('b-chess://auth-callback?ticket=cold-start');
    const first = vi.fn();
    relay.subscribe(first);
    const second = vi.fn();
    relay.subscribe(second);
    expect(second).not.toHaveBeenCalled();
  });

  it('unsubscribe stops delivering to that callback', () => {
    const relay = new AuthCallbackRelay();
    const callback = vi.fn();
    const unsubscribe = relay.subscribe(callback);
    unsubscribe();
    relay.deliver('b-chess://auth-callback?ticket=abc');
    expect(callback).not.toHaveBeenCalled();
  });
});
