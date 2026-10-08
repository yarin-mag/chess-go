import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/features/game/gameStore';
import { useOnlineLobbyStore } from '@/features/online/onlineLobbyVisibilityStore';
import { usePuzzleProgressStore } from '@/features/puzzle/puzzleProgressStore';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { totalStagePuzzleCount } from '@/features/puzzle/puzzles';
import { NewGameMenu } from './NewGameMenu';
import { CoachBubble } from './ui/CoachBubble';
import { MiniBoard } from './ui/MiniBoard';
import { Modal } from './ui/Modal';
import { Pill } from './ui/Pill';
import styles from './HomeScreen.module.css';

/** Home tab: the design's "coach conversation" — a few generated lines reflecting real progress/state,
 *  then reply pills for what to do next. Replaces the old NewGameMenu-as-landing-screen; NewGameMenu's
 *  form is still here, just reframed as the "Something else…" sheet. */
export function HomeScreen() {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { status, history, result, resumeGame } = useGameStore();
  const pausedGame = status === 'menu' && history.length > 0 && result === null;

  const { furthestStage, furthestPuzzleIndex } = usePuzzleProgressStore();
  const remainingInStage = totalStagePuzzleCount(furthestStage) - furthestPuzzleIndex;

  const startDaily = usePuzzleStore((s) => s.startDaily);
  const showOnlineLobby = useOnlineLobbyStore((s) => s.show);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.wordmark}>{t('common:appTitle')}</span>
      </header>

      <div className={styles.conversation}>
        <div className={styles.coachRow}>
          <span className={styles.coachAvatar} aria-hidden>
            ♞
          </span>
          <div className={styles.bubbles}>
            {remainingInStage > 0 && <CoachBubble>{t('nav:homePuzzlesAway', { count: remainingInStage })}</CoachBubble>}
            {pausedGame && (
              <>
                <CoachBubble>{t('nav:homeResumeGame')}</CoachBubble>
                <CoachBubble padded={false}>
                  <div className={styles.gamePreview}>
                    <MiniBoard fen={history[history.length - 1].fen} size={76} />
                    <div className={styles.gamePreviewInfo}>
                      <span className={styles.gamePreviewTitle}>{t('nav:homeGamePreviewTitle')}</span>
                      <span className={styles.gamePreviewMeta}>{t('nav:homeGamePreviewMeta', { move: history.length + 1 })}</span>
                    </div>
                  </div>
                </CoachBubble>
              </>
            )}
            {!pausedGame && remainingInStage <= 0 && <CoachBubble>{t('nav:homeGreetingFallback')}</CoachBubble>}
          </div>
        </div>
      </div>

      <div className={styles.replies}>
        <Pill variant="primary" onClick={showOnlineLobby}>
          {t('nav:homePlayOnline')}
        </Pill>
        {pausedGame && (
          <Pill variant="secondary" onClick={resumeGame}>
            {t('nav:homeResumePill')}
          </Pill>
        )}
        <Pill variant="secondary" onClick={startDaily}>
          {t('nav:homeDailyPuzzle')}
        </Pill>
        <Pill variant="ghost" onClick={() => setPickerOpen(true)}>
          {t('nav:homeSomethingElse')}
        </Pill>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <NewGameMenu onStarted={() => setPickerOpen(false)} />
      </Modal>
    </div>
  );
}
