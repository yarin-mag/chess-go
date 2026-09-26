import { createVisibilityStore } from '@/features/shared/visibilityStore';

/** Just a screen-visibility flag — the actual opening data lives in curatedOpenings.ts (pure, no store needed). */
export const useOpeningExplorerStore = createVisibilityStore();
