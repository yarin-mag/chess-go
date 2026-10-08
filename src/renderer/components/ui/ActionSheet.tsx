import styles from './ActionSheet.module.css';

export interface ActionSheetItem {
  key: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
}

/** A small backdrop + bottom sheet of one-tap actions (the "⋯" menu on Game: Undo, Flip, Settings,
 *  Resign, …). Generic so any screen needing an overflow menu can reuse it instead of a bespoke popover. */
export function ActionSheet({ open, onClose, items }: Props) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {items.map((item) => (
          <button
            key={item.key}
            className={`${styles.item} ${item.variant === 'danger' ? styles.danger : ''}`}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
