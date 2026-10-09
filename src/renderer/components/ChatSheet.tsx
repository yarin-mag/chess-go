import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/features/online/chatStore';
import { useOnlineStore } from '@/features/online/onlineStore';
import { EMOJI_REACTION_KEYS, PHRASE_REACTION_KEYS } from '@/features/online/protocol';
import { useSettingsStore } from '@/features/settings/settingsStore';
import styles from './ChatSheet.module.css';

interface ChatPanelBodyProps {
  /** Whether the panel is actually showing right now — drives the scroll-to-latest effect, since the
   *  underlying message list keeps existing (and growing) even while the panel itself is hidden (the
   *  mobile sheet unmounts it via `open`, but the desktop inline tab just hides it with CSS). */
  visible: boolean;
}

/** The message log + quick-phrase chips + emoji tray + composer, with no sheet chrome of its own — the
 *  content both `ChatSheet` (mobile's full sheet) and `GameScreen`'s desktop inline Chat tab (3y) render,
 *  so the two surfaces can never drift apart. Reuses the existing reaction protocol/keys for both the
 *  phrases and the emoji tray — see protocol.ts's EMOJI_REACTION_KEYS/PHRASE_REACTION_KEYS split. */
export function ChatPanelBody({ visible }: ChatPanelBodyProps) {
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
    if (visible) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [visible, visibleMessages.length]);

  const submit = () => {
    if (!draft.trim()) return;
    sendChat(draft);
    setDraft('');
  };

  return (
    <>
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
    </>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/** The online game's chat sheet (3h) for phone widths — `ChatPanelBody` plus the header/close chrome that
 *  makes it a slide-up overlay. At desktop widths `GameScreen` renders `ChatPanelBody` inline instead (3y). */
export function ChatSheet({ open, onClose }: Props) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <span className={styles.title}>{t('online:chatTitle')}</span>
        <button className={styles.close} aria-label={t('online:chatClose')} onClick={onClose}>
          ✕
        </button>
      </div>
      <ChatPanelBody visible={open} />
    </div>
  );
}
