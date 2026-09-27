import { createVisibilityStore } from '@/features/shared/visibilityStore';

/** Just a screen-visibility flag — the actual data lives in savedGamesStore.ts. */
export const useSavedGamesVisibilityStore = createVisibilityStore();
