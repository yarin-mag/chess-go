import type { BoardTheme } from '@/features/settings/settingsStore';

export interface BoardColors {
  label: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: Record<BoardTheme, BoardColors> = {
  classic: { label: 'Classic', light: '#f0d9b5', dark: '#b58863' },
  green: { label: 'Forest', light: '#eeeed2', dark: '#769656' },
  blue: { label: 'Ocean', light: '#dee3e6', dark: '#8ca2ad' },
  dark: { label: 'Midnight', light: '#7d8796', dark: '#4b5563' },
};
