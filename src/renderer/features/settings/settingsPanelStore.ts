import { createVisibilityStore } from '@/features/shared/visibilityStore';

/** Whether the Settings panel overlay is open — shared across every screen that can open it (Me's gear
 *  icon, the desktop nav rail's gear icon, GameScreen's control bar), so there's one open/close flag
 *  instead of each caller owning its own local state and its own `<SettingsPanel>` mount. */
export const useSettingsPanelStore = createVisibilityStore();
