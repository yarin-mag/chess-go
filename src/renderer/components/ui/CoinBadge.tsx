import styles from './CoinBadge.module.css';

interface Props {
  amount: number;
  size?: number;
}

/** The coin glyph + balance pill used wherever the design shows the wallet (Home header, Me, Shop). One
 *  component so the coin's look (filled disc + inner ring) never drifts between screens. */
export function CoinBadge({ amount, size = 18 }: Props) {
  return (
    <span className={styles.badge}>
      <span className={styles.coin} style={{ width: size, height: size, boxShadow: `inset 0 0 0 ${Math.max(2, size / 5)}px var(--coin-ring, oklch(0.7 0.14 70))` }} />
      {amount.toLocaleString()}
    </span>
  );
}
