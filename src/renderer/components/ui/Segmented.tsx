import styles from './Segmented.module.css';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Row of mutually exclusive choices (mode, difficulty, time control...). */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className={styles.row} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={`${styles.option} ${o.value === value ? styles.active : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
