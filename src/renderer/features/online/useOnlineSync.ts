import { useEffect, useRef } from 'react';
import { useGameStore } from '@/features/game/gameStore';
import { useOnlineStore } from './onlineStore';
import { isKnownReaction } from './protocol';
import { useReactionStore } from './reactionStore';

/** Relays local moves out over the connection and applies incoming resign/draw/reaction messages. Mount once, in GameScreen, only while an online game is connected. */
export function useOnlineSync(): void {
  const history = useGameStore((s) => s.history);
  const localColor = useOnlineStore((s) => s.localColor);
  const connection = useOnlineStore((s) => s.connection);

  const previousLength = useRef(0);
  useEffect(() => {
    if (!connection || !localColor) return;
    const grew = history.length > previousLength.current;
    previousLength.current = history.length;
    if (!grew) return;
    const last = history[history.length - 1];
    if (last.color !== localColor) return; // this move arrived from the network — don't echo it back
    connection.send({ type: 'move', move: { from: last.from, to: last.to, promotion: last.promotion }, at: Date.now() });
  }, [history, connection, localColor]);

  useEffect(() => {
    if (!connection) return;
    return connection.onMessage((msg) => {
      if (msg.type === 'resign') {
        const opponentColor = localColor === 'w' ? 'b' : 'w';
        useGameStore.getState().resign(opponentColor!);
      } else if (msg.type === 'drawResponse' && msg.accepted) {
        useGameStore.getState().agreeDraw();
      } else if (msg.type === 'reaction' && isKnownReaction(msg.text)) {
        useReactionStore.getState().show(msg.text);
      }
    });
  }, [connection, localColor]);

  useEffect(() => {
    if (!connection || !localColor) return;
    // The side still connected didn't do anything wrong — they win by the opponent's disconnection.
    return connection.onClose(() => {
      useGameStore.getState().handleDisconnect(localColor);
    });
  }, [connection, localColor]);
}
