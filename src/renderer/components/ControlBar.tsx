import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { opposite } from '@/core/types';
import { isOnlineGame, useGameStore } from '@/features/game/gameStore';
import { useOnlineStore } from '@/features/online/onlineStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { ActionSheet, type ActionSheetItem } from './ui/ActionSheet';
import { Pill } from './ui/Pill';
import { ReactionPicker } from './ReactionPicker';
import styles from './ControlBar.module.css';

type Armed = 'resign' | 'draw' | null;
const CONFIRM_MS = 3000;

interface Props {
  onOpenSettings: () => void;
}

/** In-game actions (3b): a favourites emoji row (online only), the primary "Ask the coach" pill, and a
 *  "⋯" sheet for everything else — undo/flip/settings/draw/resign/leave. Destructive actions (resign /
 *  draw) still need a second tap to confirm, same as before. */
export function ControlBar({ onOpenSettings }: Props) {
  const { t } = useTranslation();
  const {
    status,
    game,
    players,
    history,
    config,
    flipped,
    hintLoading,
    lastSavedGameId,
    undo,
    setFlipped,
    resign,
    agreeDraw,
    requestHint,
    backToMenu,
  } = useGameStore();
  const startReview = useReviewStore((s) => s.start);
  const onlineConnection = useOnlineStore((s) => s.connection);
  const incomingDrawOffer = useOnlineStore((s) => s.incomingDrawOffer);
  const clearDrawOffer = useOnlineStore((s) => s.clearDrawOffer);
  const drawOfferSent = useOnlineStore((s) => s.drawOfferSent);
  const sendDrawOffer = useOnlineStore((s) => s.sendDrawOffer);
  const [armed, setArmed] = useState<Armed>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [armed]);

  const playing = status === 'playing';
  const isOnline = isOnlineGame(players);
  const vsComputer = !isOnline && (players.w.kind !== 'human' || players.b.kind !== 'human');
  const turn = game.turn();
  const canAskForHelp = playing && players[turn].kind === 'human';
  // The human resigns, never the computer.
  const resigningColor = players[turn].kind === 'human' ? turn : opposite(turn);

  const confirm = (action: Exclude<Armed, null>, run: () => void) => () => {
    if (armed === action) {
      setArmed(null);
      run();
    } else setArmed(action);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setArmed(null);
  };

  const items: ActionSheetItem[] = [
    {
      key: 'undo',
      label: t('common:undo'),
      disabled: !playing || history.length === 0 || isOnline,
      onClick: () => {
        undo();
        closeMenu();
      },
    },
    {
      key: 'flip',
      label: t('common:flip'),
      onClick: () => {
        setFlipped(!flipped);
        closeMenu();
      },
    },
    {
      key: 'settings',
      label: t('common:settings'),
      onClick: () => {
        onOpenSettings();
        closeMenu();
      },
    },
  ];

  if (!vsComputer && !isOnline) {
    items.push({
      key: 'draw',
      label: armed === 'draw' ? t('game:drawLocalConfirm') : t('game:drawLocal'),
      disabled: !playing,
      onClick: confirm('draw', () => {
        agreeDraw();
        closeMenu();
      }),
    });
  }
  if (isOnline && !incomingDrawOffer) {
    items.push({
      key: 'offerDraw',
      label: drawOfferSent ? t('game:offerSent') : armed === 'draw' ? t('game:offerDrawConfirm') : t('game:offerDraw'),
      disabled: !playing || drawOfferSent,
      onClick: confirm('draw', () => {
        sendDrawOffer();
        closeMenu();
      }),
    });
  }
  if (isOnline && incomingDrawOffer) {
    items.push(
      {
        key: 'acceptDraw',
        label: t('game:acceptDraw'),
        onClick: () => {
          onlineConnection?.send({ type: 'drawResponse', accepted: true });
          clearDrawOffer();
          agreeDraw();
          closeMenu();
        },
      },
      {
        key: 'declineDraw',
        label: t('game:decline'),
        onClick: () => {
          onlineConnection?.send({ type: 'drawResponse', accepted: false });
          clearDrawOffer();
          closeMenu();
        },
      },
    );
  }

  items.push({
    key: 'resign',
    label: armed === 'resign' ? t('game:resignConfirm') : t('game:resign'),
    disabled: !playing,
    variant: 'danger',
    onClick: confirm('resign', () => {
      resign(resigningColor);
      if (isOnline) onlineConnection?.send({ type: 'resign' });
      closeMenu();
    }),
  });

  if (status === 'over') {
    items.push({
      key: 'review',
      label: t('game:review'),
      onClick: () => {
        startReview(config, history, { sourceGameId: lastSavedGameId ?? undefined });
        closeMenu();
      },
    });
  }

  items.push({
    key: 'leave',
    label: t('common:menu'),
    onClick: () => {
      // Always tear down any online connection here, not just when isOnline — leaving it live would
      // outlive this game and get mistaken for an active connection by whatever plays next (a no-op
      // for a local/computer game, where there's never a connection to close).
      useOnlineStore.getState().leave();
      backToMenu();
      closeMenu();
    },
  });

  return (
    <div className={styles.bar}>
      {isOnline && <ReactionPicker />}
      <div className={styles.primaryRow}>
        <Pill variant="primary" className={styles.coach} disabled={!canAskForHelp || hintLoading} onClick={() => void requestHint()}>
          {hintLoading ? '…' : t('game:askCoach')}
        </Pill>
        <button className={styles.more} aria-label={t('game:gameMenu')} onClick={() => setMenuOpen(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>
      <ActionSheet open={menuOpen} onClose={closeMenu} items={items} />
    </div>
  );
}
