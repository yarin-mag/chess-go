import { useSettingsStore, type BoardTheme } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { Modal } from './ui/Modal';
import { Toggle } from './ui/Toggle';
import styles from './SettingsPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: Props) {
  const { showLegalMoves, soundOn, autoFlip, boardTheme, update } = useSettingsStore();

  return (
    <Modal open={open} onClose={onClose}>
      <div className={styles.content}>
        <h2>Settings</h2>
        <Toggle
          label="Show legal moves"
          description="Outline where the selected piece can go in blue"
          checked={showLegalMoves}
          onChange={(v) => update({ showLegalMoves: v })}
        />
        <Toggle label="Sound effects" checked={soundOn} onChange={(v) => update({ soundOn: v })} />
        <Toggle
          label="Auto-flip board"
          description="Local 2-player: turn the board to the side that moves next"
          checked={autoFlip}
          onChange={(v) => update({ autoFlip: v })}
        />
        <div>
          <p className={styles.heading}>Board theme</p>
          <div className={styles.themes}>
            {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((key) => {
              const t = BOARD_THEMES[key];
              return (
                <button
                  key={key}
                  className={`${styles.swatch} ${key === boardTheme ? styles.selected : ''}`}
                  onClick={() => update({ boardTheme: key })}
                  aria-label={`${t.label} board`}
                  aria-pressed={key === boardTheme}
                >
                  <span className={styles.preview} style={{ background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)` }} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
