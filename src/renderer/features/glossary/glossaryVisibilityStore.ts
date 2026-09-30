// src/renderer/features/glossary/glossaryVisibilityStore.ts
import { createVisibilityStore } from '@/features/shared/visibilityStore';

/** Just a screen-visibility flag — Glossary has no other state (no persisted progress, nothing to load). */
export const useGlossaryVisibilityStore = createVisibilityStore();
