import styles from './Toggle.module.css';

interface Props {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Labelled on/off switch. */
export function Toggle({ label, description, checked, onChange }: Props) {
  return (
    <label className={styles.row}>
      <span>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.track} aria-hidden>
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
