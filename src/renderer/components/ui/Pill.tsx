import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillVariant = 'primary' | 'secondary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillVariant;
  icon?: ReactNode;
}

/** Generic pill-shaped button used throughout the Round 3 phone shell: `primary` is the single solid
 *  cream fill the design system reserves for the one main action on a screen, `secondary` is the
 *  outlined variant for alternative actions, `ghost` is text-only (e.g. "Something else…"). One
 *  component instead of one-off pill markup per screen (Home replies, Game actions, Review nav, …). */
export function Pill({ variant = 'secondary', icon, children, className, ...rest }: Props) {
  return (
    <button className={[styles.pill, styles[variant], className].filter(Boolean).join(' ')} {...rest}>
      {icon}
      {children}
    </button>
  );
}
