import type { ReactNode } from 'react';
import styles from './SectionKicker.module.css';

/** Small uppercase section label (e.g. "LOADOUT", "RECENT") used to head a group of rows. */
export function SectionKicker({ children }: { children: ReactNode }) {
  return <span className={styles.kicker}>{children}</span>;
}
