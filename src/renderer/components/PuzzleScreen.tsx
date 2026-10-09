import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colorName } from '@/features/game/labels';
import { phraseFor } from '@/engine/explain';
import { usePuzzleProgressStore } from '@/features/puzzle/puzzleProgressStore';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { STAGE_COUNT, totalStagePuzzleCount } from '@/features/puzzle/puzzles';
import { usePuzzleEffects } from '@/hooks/usePuzzleEffects';
import { PuzzleBoard } from './PuzzleBoard';
import { CoachBubble } from './ui/CoachBubble';
import { CoinBadge } from './ui/CoinBadge';
import { ActionSheet, type ActionSheetItem } from './ui/ActionSheet';
import { Pill } from './ui/Pill';
import { ProgressBar } from './ui/ProgressBar';
import styles from './PuzzleScreen.module.css';

const formatRushTime = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

interface Props {
  onExit: () => void;
}

export function PuzzleScreen({ onExit }: Props) {
  const { t } = useTranslation();
  usePuzzleEffects();
  const {
    status,
    mode,
    stage,
    puzzleIndex,
    puzzle,
    feedback,
    hint,
    lastReward,
    rushRemainingMs,
    rushSolvedCount,
    rushResult,
    retry,
    next,
    showHint,
    showMap,
    startRush,
  } = usePuzzleStore();
  const currentStreak = usePuzzleProgressStore((s) => s.currentStreak);
  const stageSize = totalStagePuzzleCount(stage);
  const solverColor = puzzle ? (puzzle.fen.split(' ')[1] as 'w' | 'b') : 'w';
  const [menuOpen, setMenuOpen] = useState(false);

  const title =
    mode === 'daily' ? t('puzzles:dailyPuzzle') : mode === 'vault' ? t('puzzles:vaultLabel') : t(`puzzles:stage_${stage}`, { defaultValue: t('puzzles:stageFallback', { n: stage + 1 }) });

  const menuItems: ActionSheetItem[] = [
    {
      key: 'map',
      label: t('common:map'),
      onClick: () => {
        setMenuOpen(false);
        showMap();
      },
    },
    {
      key: 'menu',
      label: t('common:menu'),
      onClick: () => {
        setMenuOpen(false);
        onExit();
      },
    },
  ];

  return (
    <div className={`round3 ${styles.screen}`}>
      <PuzzleBoard />
      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <button className={styles.back} aria-label={t('common:menu')} onClick={onExit}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className={styles.headerText}>
            <span className={styles.headerTitle}>{title}</span>
            {mode === 'ladder' && status !== 'rushOver' && (
              <span className={styles.headerSubtitle}>{t('puzzles:stageProgress', { stage: stage + 1, total: STAGE_COUNT, puzzle: puzzleIndex + 1, size: stageSize })}</span>
            )}
          </div>
          {(mode === 'ladder' || mode === 'daily') && currentStreak > 0 && (
            <span className={styles.streak}>{t('puzzles:streak', { count: currentStreak })}</span>
          )}
        </div>

        {mode === 'ladder' && status !== 'rushOver' && <ProgressBar size={stageSize} current={puzzleIndex} />}

        {mode === 'rush' && status !== 'rushOver' && (
          <div className={styles.rushBar}>
            <span>{t('puzzles:rushTimer', { time: formatRushTime(rushRemainingMs) })}</span>
            <span>{t('puzzles:rushSolvedCount', { count: rushSolvedCount })}</span>
          </div>
        )}

        {status === 'playing' && <p className={styles.instruction}>{t('puzzles:findBestMove', { color: colorName(solverColor) })}</p>}
        {status === 'wrong' && <p className={styles.instruction}>{t('puzzles:notQuiteTitle')}</p>}
        {status === 'solved' && <p className={styles.instruction}>{t('puzzles:solved')}</p>}

        <div className={styles.body}>
          {status === 'playing' && mode !== 'rush' && hint && (
            <CoachBubble>{hint.text}</CoachBubble>
          )}

          {status === 'wrong' && feedback && (
            <CoachBubble>{feedback.tags.map((tag, i) => phraseFor(tag, feedback.tier, feedback.move.san, i)).join(' ')}</CoachBubble>
          )}

          {status === 'solved' && feedback && (
            <CoachBubble>
              {feedback.tags.map((tag, i) => phraseFor(tag, feedback.tier, feedback.move.san, i)).join(' ')}
              {lastReward != null && (
                <>
                  {' '}
                  <CoinBadge amount={lastReward} size={14} />
                </>
              )}
            </CoachBubble>
          )}

          {status === 'rushOver' && rushResult && (
            <div className={styles.rushOver}>
              <p className={styles.rushOverTitle}>{rushResult.reason === 'timeUp' ? t('puzzles:timeUp') : t('puzzles:runOver')}</p>
              {feedback && rushResult.reason === 'wrong' && (
                <CoachBubble>{feedback.tags.map((tag, i) => phraseFor(tag, feedback.tier, feedback.move.san, i)).join(' ')}</CoachBubble>
              )}
              <p className={styles.rushScore}>{t('puzzles:scoreLine', { score: rushResult.score, newBest: rushResult.isNewBest ? t('puzzles:newBestSuffix') : '' })}</p>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {status === 'playing' && mode !== 'rush' && !hint && (
            <>
              <Pill variant="primary" className={styles.primaryAction} onClick={showHint}>
                {t('puzzles:askForHelp')}
              </Pill>
              <button className={styles.more} aria-label={t('game:gameMenu')} onClick={() => setMenuOpen(true)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>
            </>
          )}

          {status === 'wrong' && (
            <Pill variant="primary" className={styles.primaryAction} onClick={retry}>
              {t('puzzles:tryAgain')}
            </Pill>
          )}

          {status === 'solved' && (
            <Pill variant="primary" className={styles.primaryAction} onClick={next}>
              {mode === 'daily' ? t('puzzles:backToMapArrow') : t('puzzles:nextPuzzleArrow')}
            </Pill>
          )}

          {status === 'rushOver' && rushResult && (
            <>
              <Pill variant="secondary" onClick={showMap}>
                {t('puzzles:backToMap')}
              </Pill>
              <Pill variant="primary" onClick={() => startRush(usePuzzleStore.getState().rushDuration!)}>
                {t('puzzles:playAgain')}
              </Pill>
            </>
          )}
        </div>
      </aside>

      <ActionSheet open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
    </div>
  );
}
