import { createVisibilityStore } from '@/features/shared/visibilityStore';

/** Just a screen-visibility flag — the actual data lives in gameHistoryStore.ts / weaknessStats.ts. */
export const useWeaknessDashboardStore = createVisibilityStore();
