import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TIME_PRESETS } from '@/features/clock/presets';
import { useOnlineStore } from '@/features/online/onlineStore';
import { Segmented } from './ui/Segmented';
import styles from './OnlineLobbyScreen.module.css';

interface Props {
  onExit: () => void;
}

type Tab = 'host' | 'join';

export function OnlineLobbyScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const { status, roomCode, error, hostGame, joinGame, leave } = useOnlineStore();
  const [tab, setTab] = useState<Tab>('host');
  const [preset, setPreset] = useState(TIME_PRESETS[3].name); // Rapid 10+0 default
  const [joinCode, setJoinCode] = useState('');

  const timeControl = TIME_PRESETS.find((tc) => tc.name === preset)!;
  const busy = status === 'hosting' || status === 'joining';

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>{t('online:lobbyTitle')}</h1>

        {status === 'connected' ? (
          <p>{t('online:connectedStarting')}</p>
        ) : (
          <>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'host', label: t('online:hostTab') },
                { value: 'join', label: t('online:joinTab') },
              ]}
            />

            {tab === 'host' && (
              <div className={styles.section}>
                <p className={styles.label}>{t('common:timeControl')}</p>
                <Segmented
                  value={preset}
                  onChange={setPreset}
                  options={TIME_PRESETS.map((tc) => ({ value: tc.name, label: tc.name }))}
                />
                {status === 'hosting' && roomCode ? (
                  <div className={styles.codeBox}>
                    <p className={styles.codeLabel}>{t('online:shareCode')}</p>
                    <p className={styles.code}>{roomCode}</p>
                    <p className={styles.waiting}>{t('online:waitingForJoin')}</p>
                  </div>
                ) : (
                  <button className="btn btn-primary" disabled={busy} onClick={() => hostGame(timeControl)}>
                    {t('online:createRoom')}
                  </button>
                )}
              </div>
            )}

            {tab === 'join' && (
              <div className={styles.section}>
                <input
                  className={styles.input}
                  placeholder={t('online:enterRoomCode')}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button className="btn btn-primary" disabled={busy || joinCode.length < 4} onClick={() => joinGame(joinCode)}>
                  {status === 'joining' ? t('online:connecting') : t('online:join')}
                </button>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}
          </>
        )}

        <button
          className="btn"
          onClick={() => {
            leave();
            onExit();
          }}
        >
          {t('common:menu')}
        </button>
      </div>
    </div>
  );
}
