import { Modal } from './ui/Modal';
import styles from './ReasonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
}

/** Long-form "why" behind a suggested move — kept out of the main flow since it can run several sentences. */
export function ReasonModal({ open, onClose, title, text }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className={styles.content}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.text}>{text}</p>
        <button className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
