import { describe, expect, it } from 'vitest';
import { decideGate } from './authGate';

describe('decideGate', () => {
  it('shows the app for a signed-in session regardless of connectivity', () => {
    expect(decideGate({ hasEverAuthenticated: true, status: 'signedIn', isOnline: true })).toBe('showApp');
    expect(decideGate({ hasEverAuthenticated: true, status: 'signedIn', isOnline: false })).toBe('showApp');
  });

  it('shows sign-in for a never-authenticated device that is online', () => {
    expect(decideGate({ hasEverAuthenticated: false, status: 'signedOut', isOnline: true })).toBe('showSignIn');
  });

  it('falls back to the old no-account experience for a never-authenticated device that is offline', () => {
    expect(decideGate({ hasEverAuthenticated: false, status: 'signedOut', isOnline: false })).toBe('offlineFallback');
  });

  it('blocks (never silently falls back) a previously-authenticated device that is signed out and offline', () => {
    expect(decideGate({ hasEverAuthenticated: true, status: 'signedOut', isOnline: false })).toBe('offlineBlocked');
  });

  it('shows sign-in for a previously-authenticated, now signed-out device that is online', () => {
    expect(decideGate({ hasEverAuthenticated: true, status: 'signedOut', isOnline: true })).toBe('showSignIn');
  });

  it('shows nothing conclusive yet while status is still being checked', () => {
    expect(decideGate({ hasEverAuthenticated: false, status: 'checking', isOnline: true })).toBe('checking');
  });
});
