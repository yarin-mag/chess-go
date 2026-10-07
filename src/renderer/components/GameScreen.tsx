import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { phraseFor, reasonFor } from '@/engine/explain';
import { isOnlineGame, useGameStore } from '@/features/game/gameStore';
import { useChatStore } from '@/features/online/chatStore';
import { useOnlineSync } from '@/features/online/useOnlineSync';
import { useGameEffects } from '@/hooks/useGameEffects';
import { Board } from './Board';
import { ChatSheet } from './ChatSheet';
import { ClockPanel } from './ClockPanel';
import { ControlBar } from './ControlBar';
import { GameOverModal } from './GameOverModal';
import { MoveList } from './MoveList';
import { ReactionBubble } from './ReactionBubble';
import { ReasonModal } from './ReasonModal';
import { SettingsPanel } from './SettingsPanel';
import styles from './GameScreen.module.css';

/** Board on the left; clocks, move list and controls in the sidebar. */
export function GameScreen() {
  const { t } = useTranslation();
  useGameEffects();
  const flipped = useGameStore((s) => s.flipped);
  const gameId = useGameStore((s) => s.gameId);
  const hint = useGameStore((s) => s.hint);
  const players = useGameStore((s) => s.players);
  const isOnline = isOnlineGame(players);
  useOnlineSync(); // no-ops internally unless the current game is actually online
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Collapsed by default so the move list never grows tall enough to cover the board (see MoveList);
  // on the stacked mobile layout, collapsing also lets the board grow (see GameScreen.module.css).
  const [movesCollapsed, setMovesCollapsed] = useState(true);
  // Captured at open time (title + text) rather than read live from `hint`, so the modal's content
  // doesn't change or vanish out from under the player if a move clears the hint while it's open.
  const [hintReason, setHintReason] = useState<{ title: string; text: string } | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const chatMessageCount = useChatStore((s) => s.messages.length);
  const lastSeenChatCount = useRef(0);
  const hasUnreadChat = isOnline && !chatOpen && chatMessageCount > lastSeenChatCount.current;
  useEffect(() => {
    if (chatOpen) lastSeenChatCount.current = chatMessageCount;
  }, [chatOpen, chatMessageCount]);

  // The side facing the player sits at the bottom of the board.
  const bottom = flipped ? 'b' : 'w';
  const top = flipped ? 'w' : 'b';

  return (
    <div className={`round3 ${styles.screen}`} data-moves-collapsed={movesCollapsed}>
      <Board />
      <aside className={styles.sidebar}>
        {isOnline && (
          <div className={styles.topRow}>
            <p className={styles.onlinePill}>{t('online:onlinePill')}</p>
            <button className={styles.chatButton} aria-label={t('online:chatTitle')} onClick={() => setChatOpen(true)}>
              💬
              {hasUnreadChat && <span className={styles.unreadDot} aria-hidden />}
            </button>
          </div>
        )}
        <ClockPanel color={top} />
        <MoveList collapsed={movesCollapsed} onToggleCollapsed={() => setMovesCollapsed((c) => !c)} />
        {hint && (
          <p className={styles.hintText}>
            💡 <strong>{hint.san}</strong> — {hint.tags.map((tag, i) => phraseFor(tag, 'best', hint.san, i)).join(' ')}
            <button
              className={styles.hintWhy}
              onClick={() =>
                setHintReason({
                  title: t('tutor:whyTitle', { san: hint.san }),
                  text: hint.tags.map((tag, i) => reasonFor(tag, 'best', hint.san, i)).join(' '),
                })
              }
            >
              {t('common:why')}
            </button>
          </p>
        )}
        <ClockPanel color={bottom} />
        <ControlBar onOpenSettings={() => setSettingsOpen(true)} />
      </aside>
      <GameOverModal key={gameId} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {isOnline && <ReactionBubble />}
      {isOnline && <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} />}
      <ReasonModal
        open={hintReason !== null}
        onClose={() => setHintReason(null)}
        title={hintReason?.title ?? ''}
        text={hintReason?.text ?? ''}
      />
    </div>
  );
}
