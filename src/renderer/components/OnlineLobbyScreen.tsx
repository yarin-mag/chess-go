import { useState } from 'react';
import { TIME_PRESETS } from '@/features/clock/presets';
import { useOnlineStore } from '@/features/online/onlineStore';
import { Segmented } from './ui/Segmented';
import styles from './OnlineLobbyScreen.module.css';

interface Props {
  onExit: () => void;
}

type Tab = 'host' | 'join';

export function OnlineLobbyScreen({ onExit }: Props) {
  const { status, roomCode, error, hostGame, joinGame, leave } = useOnlineStore();
  const [tab, setTab] = useState<Tab>('host');
  const [preset, setPreset] = useState(TIME_PRESETS[3].name); // Rapid 10+0 default
  const [joinCode, setJoinCode] = useState('');

  const timeControl = TIME_PRESETS.find((t) => t.name === preset)!;
  const busy = status === 'hosting' || status === 'joining';

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>Play Online</h1>

        {status === 'connected' ? (
          <p>Connected — starting the game…</p>
        ) : (
          <>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'host', label: 'Host a game' },
                { value: 'join', label: 'Join a game' },
              ]}
            />

            {tab === 'host' && (
              <div className={styles.section}>
                <p className={styles.label}>Time control</p>
                <Segmented value={preset} onChange={setPreset} options={TIME_PRESETS.map((t) => ({ value: t.name, label: t.name }))} />
                {status === 'hosting' && roomCode ? (
                  <div className={styles.codeBox}>
                    <p className={styles.codeLabel}>Share this code with your opponent</p>
                    <p className={styles.code}>{roomCode}</p>
                    <p className={styles.waiting}>Waiting for them to join…</p>
                  </div>
                ) : (
                  <button className="btn btn-primary" disabled={busy} onClick={() => hostGame(timeControl)}>
                    Create room
                  </button>
                )}
              </div>
            )}

            {tab === 'join' && (
              <div className={styles.section}>
                <input
                  className={styles.input}
                  placeholder="Enter room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button className="btn btn-primary" disabled={busy || joinCode.length < 4} onClick={() => joinGame(joinCode)}>
                  {status === 'joining' ? 'Connecting…' : 'Join'}
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
          ☰ Menu
        </button>
      </div>
    </div>
  );
}
