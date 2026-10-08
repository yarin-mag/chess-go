import styles from './SegmentedTabs.module.css';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Underline-style sub-tabs (Course/Openings/Glossary on Learn, Crates/Boards/Pieces/Emojis on Shop —
 *  Phase 3). Distinct from `Segmented` (a pill radiogroup used for mode/difficulty pickers): this is the
 *  Round 3 handoff's "active = 2px cream underline" pattern, one generic component for every screen
 *  that needs it rather than hand-rolled underline tabs per screen. */
export function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className={styles.row} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={`${styles.tab} ${o.value === value ? styles.active : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
