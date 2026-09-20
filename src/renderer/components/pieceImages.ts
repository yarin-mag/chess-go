import type { Color, PieceType } from '@/core/types';

// Vite resolves every SVG in the folder to a hashed URL at build time. Files are named like "wK.svg".
const modules = import.meta.glob('../assets/pieces/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

const IMAGES = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]),
);

export const pieceImage = (color: Color, type: PieceType): string => IMAGES[`${color}${type.toUpperCase()}`];
