import type { ReactNode } from 'react';
import styles from './CoachBubble.module.css';

interface Props {
  children: ReactNode;
  /** Renders as a flex item instead of a block row — lets a mini-board or other rich content sit
   *  inside the same rounded bubble shape as a text line (used by Home's "resume game" bubble). */
  padded?: boolean;
}

/** The rounded speech-bubble the "coach" talks through on Home/Game/Review (left-aligned, tail at the
 *  bottom-left — mirrors to bottom-right under RTL via plain `border-radius` logical values). One
 *  component so every coach line looks identical wherever it appears, instead of repeating the bubble
 *  styling per screen. */
export function CoachBubble({ children, padded = true }: Props) {
  return <div className={`${styles.bubble} ${padded ? styles.padded : ''}`}>{children}</div>;
}
