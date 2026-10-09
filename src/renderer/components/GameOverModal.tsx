import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameResult } from '@/core/types';
import { isOnlineGame, useGameStore } from '@/features/game/gameStore';
import { resultLetter } from '@/features/game/labels';
import { useOnlineStore } from '@/features/online/onlineStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { useWalletStore } from '@/features/shop/walletStore';
import { CoinBadge } from './ui/CoinBadge';
import { Emoji } from './ui/Emoji';
import { Pill } from './ui/Pill';
import styles from './GameOverModal.module.css';

const COINS_PER_WIN = 15;

const KICKER_KEY: Record<Exclude<GameResult['kind'], 'draw'>, string> = {
  checkmate: 'game:kickerCheckmate',
  timeout: 'game:kickerTimeout',
  resign: 'game:kickerResign',
  disconnected: 'game:kickerDisconnected',
};

const DRAW_KICKER_KEY: Record<Extract<GameResult, { kind: 'draw' }>['reason'], string> = {
  stalemate: 'game:drawStalemate',
  insufficient: 'game:drawInsufficient',
  threefold: 'game:drawThreefold',
  fifty: 'game:drawFifty',
  agreement: 'game:drawAgreement',
};

function resultEmojiKind(result: GameResult, won: boolean) {
  if (result.kind === 'draw') return 'stalemate';
  if (won) return 'mate-win';
  if (result.kind === 'timeout') return 'flagged';
  if (result.kind === 'resign') return 'resign-flag';
  return 'checkmated';
}

/** Result sheet sliding up over the final position (3x) — "You won/lost" from the local player's own
 *  perspective (see resultLetter), a matching Emoji, a coin reward on a win, and the existing rematch/
 *  review/new-game actions. Remounts (via `key={gameId}` in GameScreen) once per finished game, which is
 *  also what makes the coin-award effect below safe to run unconditionally on mount. */
export function GameOverModal() {
  const { t } = useTranslation();
  const { status, result, config, history, players, lastSavedGameId, startGame, backToMenu } = useGameStore();
  const startReview = useReviewStore((s) => s.start);
  const [dismissed, setDismissed] = useState(false);
  const close = () => setDismissed(true);
  const online = isOnlineGame(players);
  const open = status === 'over' && !dismissed;

  const letter = result ? resultLetter(config, result) : null;
  const won = letter === 'W';

  useEffect(() => {
    if (result && won) useWalletStore.getState().earn(COINS_PER_WIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per mount (this component remounts per game via `key`), not on every render
  }, []);

  if (!open || !result) return null;

  const detail = t(result.kind === 'draw' ? DRAW_KICKER_KEY[result.reason] : KICKER_KEY[result.kind]);
  const title = letter === 'D' ? t('game:resultDraw') : won ? t('game:youWon') : t('game:youLost');

  return (
    <div className={styles.backdrop}>
      <div className={styles.sheet}>
        <div className={styles.handle} />
        <button className={styles.close} aria-label={t('game:viewBoard')} onClick={close}>
          ✕
        </button>
        <div className={styles.headline}>
          <div className={styles.headlineText}>
            <span className={styles.kicker}>
              {detail} · {t('game:gameOverMoveCount', { count: history.length })}
            </span>
            <span className={styles.title}>{title}</span>
          </div>
          <Emoji kind={resultEmojiKind(result, won)} size={84} />
        </div>

        {won && (
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('game:coinsEarned')}</span>
              <CoinBadge amount={COINS_PER_WIN} size={17} />
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <Pill variant="primary" className={styles.primaryAction} onClick={() => startReview(config, history, { sourceGameId: lastSavedGameId ?? undefined })}>
            {t('game:reviewGame')}
          </Pill>
          <div className={styles.actionRow}>
            {!online && (
              <Pill variant="secondary" className={styles.halfAction} onClick={() => startGame(config)}>
                {t('game:rematch')}
              </Pill>
            )}
            <Pill
              variant="secondary"
              className={styles.halfAction}
              onClick={() => {
                // See ControlBar's "Menu" item for why this always runs, not just when online.
                useOnlineStore.getState().leave();
                backToMenu();
              }}
            >
              {t('game:newGame')}
            </Pill>
          </div>
        </div>
      </div>
    </div>
  );
}
