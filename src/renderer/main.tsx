import './i18n'; // configures i18next before anything else renders
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { backfillVaultIfEmpty } from './features/vault/backfillVault';
import './styles/global.css';

backfillVaultIfEmpty();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
