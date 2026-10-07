import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/features/online/chatStore';
import { useOnlineStore } from '@/features/online/onlineStore';
import { EMOJI_REACTION_KEYS, PHRASE_REACTION_KEYS } from '@/features/online/protocol';
import { useSettingsStore } from '@/features/settings/settingsStore';
import styles from './ChatSheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** The online game's chat sheet (3h): message log + quick-phrase chips + an emoji tray, with free-text
 *  input unless "Quick phrases only" is on. Reuses the existing reaction protocol/keys for both the
 *  phrases and the emoji tray — see protocol.ts's EMOJI_REACTION_KEYS/PHRASE_REACTION_KEYS split. */
export function ChatSheet({ open, onClose }: Props) {
  const { t } = useTranslation();
  const messages = useChatStore((s) => s.messages);
  const sendReaction = useOnlineStore((s) => s.sendReaction);
  const sendChat = useOnlineStore((s) => s.sendChat);
  const quickPhrasesOnly = useSettingsStore((s) => s.quickPhrasesOnly);
  const chatEmojisFromOpponent = useSettingsStore((s) => s.chatEmojisFromOpponent);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const visibleMessages = messages.filter((m) => chatEmojisFromOpponent || m.kind !== 'reaction' || m.from !== 'opponent');

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, visibleMessages.length]);

  if (!open) return null;

  const submit = () => {
    if (!draft.trim()) return;
    sendChat(draft);
    setDraft('');
  };

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <span className={styles.title}>{t('online:chatTitle')}</span>
        <button className={styles.close} aria-label={t('online:chatClose')} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.messages} ref={listRef}>
        {visibleMessages.map((m) => (
          <div key={m.id} className={styles.messageRow} style={{ justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
            <span className={`${styles.bubble} ${m.from === 'me' ? styles.bubbleMe : styles.bubbleOpponent}`}>{m.text}</span>
          </div>
        ))}
      </div>

      <div className={styles.chips}>
        {PHRASE_REACTION_KEYS.map((key) => (
          <button key={key} className={styles.chip} onClick={() => sendReaction(key)}>
            {t(`online:reaction_${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.emojiTray}>
        {EMOJI_REACTION_KEYS.map((key) => (
          <button key={key} className={styles.emojiTile} aria-label={t(`online:reaction_${key}`)} onClick={() => sendReaction(key)}>
            {t(`online:reaction_${key}`)}
          </button>
        ))}
      </div>

      {!quickPhrasesOnly && (
        <div className={styles.composer}>
          <input
            className={styles.input}
            value={draft}
            maxLength={200}
            placeholder={t('online:chatPlaceholder')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className={styles.send} aria-label={t('online:chatSend')} onClick={submit} disabled={!draft.trim()}>
            ➤
          </button>
        </div>
      )}
    </div>
  );
}
