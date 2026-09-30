interface ElectronAuthAPI {
  openExternalSignIn(url: string): Promise<void>;
  onAuthCallback(callback: (url: string) => void): () => void;
}

declare global {
  interface Window {
    electronAuth?: ElectronAuthAPI;
  }
}

export {};
