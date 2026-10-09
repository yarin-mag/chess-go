import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BOARD_CATALOGUE, boardCatalogueEntry, CRATE_ODDS, CRATE_PRICE, rollCrate, type BoardCatalogueEntry, type Rarity } from '@/features/shop/catalogue';
import { useInventoryStore } from '@/features/shop/inventoryStore';
import { useWalletStore } from '@/features/shop/walletStore';
import { useSettingsStore, type BoardTheme } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { CoinBadge } from './ui/CoinBadge';
import { Pill } from './ui/Pill';
import { SectionKicker } from './ui/SectionKicker';
import { SegmentedTabs } from './ui/SegmentedTabs';
import styles from './ShopScreen.module.css';

type SubTab = 'crates' | 'boards' | 'pieces' | 'emojis';

/** The 4 pre-shop board themes plus every catalogue one, in catalogue price order (frees first). */
const ALL_BOARD_THEMES: BoardTheme[] = [
  'classic',
  'green',
  'blue',
  'dark',
  ...BOARD_CATALOGUE.map((e) => e.theme),
];

function BoardTile({ theme }: { theme: BoardTheme }) {
  const { t } = useTranslation();
  const colors = BOARD_THEMES[theme];
  const entry = boardCatalogueEntry(theme);
  const equipped = useSettingsStore((s) => s.boardTheme === theme);
  const owned = useInventoryStore((s) => s.owns(theme));
  const coins = useWalletStore((s) => s.coins);
  const update = useSettingsStore((s) => s.update);
  const unlock = useInventoryStore((s) => s.unlock);
  const spend = useWalletStore((s) => s.spend);

  const buy = () => {
    if (!entry || !spend(entry.price)) return;
    unlock(theme);
    update({ boardTheme: theme });
  };

  return (
    <button
      className={`${styles.boardTile} ${equipped ? styles.boardTileEquipped : ''}`}
      disabled={!owned && (!entry || coins < entry.price)}
      onClick={() => (owned ? update({ boardTheme: theme }) : buy())}
    >
      <span
        className={styles.boardPreview}
        style={{
          background: `linear-gradient(135deg, ${colors.light} 50%, ${colors.dark} 50%)`,
          borderBottomColor: entry ? `var(--rarity-${entry.rarity})` : 'transparent',
        }}
      />
      <span className={styles.boardName}>{colors.label}</span>
      {equipped ? (
        <span className={styles.boardState}>{t('nav:shopEquipped')}</span>
      ) : owned ? (
        <span className={styles.boardState}>{t('nav:shopOwned')}</span>
      ) : entry ? (
        <CoinBadge amount={entry.price} size={14} />
      ) : null}
    </button>
  );
}

/** Highest-rarity catalogue entry (ties broken by price) — the single item 3z's desktop "Featured"
 *  spotlight calls out above the grid. Purely a presentation pick; it owns no data of its own. */
const RARITY_RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const FEATURED_ENTRY = BOARD_CATALOGUE.reduce((best, e) =>
  RARITY_RANK[e.rarity] > RARITY_RANK[best.rarity] || (RARITY_RANK[e.rarity] === RARITY_RANK[best.rarity] && e.price > best.price) ? e : best,
);

/** Desktop-only spotlight (3z) for the catalogue's standout item — same buy/equip logic as `BoardTile`,
 *  just laid out large next to the grid instead of as one more tile in it. Hidden below the desktop
 *  breakpoint by CSS, so it costs nothing on the phone layout. */
function FeaturedBoard() {
  const { t } = useTranslation();
  const entry = FEATURED_ENTRY;
  const colors = BOARD_THEMES[entry.theme];
  const equipped = useSettingsStore((s) => s.boardTheme === entry.theme);
  const owned = useInventoryStore((s) => s.owns(entry.theme));
  const coins = useWalletStore((s) => s.coins);
  const update = useSettingsStore((s) => s.update);
  const unlock = useInventoryStore((s) => s.unlock);
  const spend = useWalletStore((s) => s.spend);

  const buy = () => {
    if (!spend(entry.price)) return;
    unlock(entry.theme);
    update({ boardTheme: entry.theme });
  };

  return (
    <div className={styles.featured}>
      <SectionKicker>
        {t('nav:shopFeatured')} · {t(`nav:rarity_${entry.rarity}`)}
      </SectionKicker>
      <span
        className={styles.featuredPreview}
        style={{
          background: `linear-gradient(135deg, ${colors.light} 50%, ${colors.dark} 50%)`,
          boxShadow: `0 0 0 4px var(--rarity-${entry.rarity})`,
        }}
      />
      <div className={styles.featuredFooter}>
        <div className={styles.featuredInfo}>
          <span className={styles.featuredName}>{colors.label}</span>
          <span className={styles.featuredMeta}>{t('nav:shopFeaturedSubtitle')}</span>
        </div>
        <Pill
          variant="primary"
          disabled={!owned && coins < entry.price}
          onClick={() => (owned ? update({ boardTheme: entry.theme }) : buy())}
        >
          {equipped ? t('nav:shopEquipped') : owned ? t('nav:shopOwned') : <>{t('nav:shopBuy')} <CoinBadge amount={entry.price} size={14} /></>}
        </Pill>
      </div>
    </div>
  );
}

function CratesTab() {
  const { t } = useTranslation();
  const coins = useWalletStore((s) => s.coins);
  const spend = useWalletStore((s) => s.spend);
  const unlock = useInventoryStore((s) => s.unlock);
  const update = useSettingsStore((s) => s.update);
  const owned = useInventoryStore((s) => s.ownedBoardThemes);
  const [revealed, setRevealed] = useState<BoardCatalogueEntry | null>(null);

  const open = () => {
    if (!spend(CRATE_PRICE)) return;
    const prize = rollCrate(owned);
    unlock(prize.theme);
    update({ boardTheme: prize.theme });
    setRevealed(prize);
  };

  return (
    <div className={styles.cratesBody}>
      <h1 className={styles.crateTitle}>{t('nav:shopCrateTitle')}</h1>
      <p className={styles.crateSubtitle}>{t('nav:shopCrateSubtitle')}</p>

      <div className={styles.previewRow}>
        {BOARD_CATALOGUE.map((e) => (
          <span key={e.theme} className={styles.previewSwatch} style={{ background: `linear-gradient(135deg, ${BOARD_THEMES[e.theme].light} 50%, ${BOARD_THEMES[e.theme].dark} 50%)` }} />
        ))}
      </div>

      <div className={styles.oddsLegend}>
        {CRATE_ODDS.map((o) => (
          <span key={o.rarity} className={styles.oddsItem}>
            <span className={styles.oddsDot} style={{ background: `var(--rarity-${o.rarity})` }} />
            {t(`nav:rarity_${o.rarity}`)} <span className={styles.oddsPercent}>{o.percent}%</span>
          </span>
        ))}
      </div>

      <Pill variant="primary" disabled={coins < CRATE_PRICE} onClick={open}>
        {t('nav:shopOpenFor')} <CoinBadge amount={CRATE_PRICE} />
      </Pill>

      {revealed && (
        <p className={styles.revealLine}>
          {t('nav:shopYouGot', { name: BOARD_THEMES[revealed.theme].label })}
        </p>
      )}
    </div>
  );
}

function ComingSoonTab() {
  const { t } = useTranslation();
  return <p className={styles.note}>{t('nav:shopComingSoon')}</p>;
}

/** Shop tab (3d): a fully working mock economy for board skins — direct purchase and crates — backed by
 *  `walletStore`/`inventoryStore`. Pieces/Emojis stay a placeholder (see catalogue.ts's doc comment):
 *  this app has no renderable piece-set/emoji system yet for a catalogue of them to mean anything. */
export function ShopScreen() {
  const { t } = useTranslation();
  const [sub, setSub] = useState<SubTab>('crates');
  const coins = useWalletStore((s) => s.coins);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <SegmentedTabs
          value={sub}
          onChange={setSub}
          options={[
            { value: 'crates', label: t('nav:shopTabCrates') },
            { value: 'boards', label: t('nav:shopTabBoards') },
            { value: 'pieces', label: t('nav:shopTabPieces') },
            { value: 'emojis', label: t('nav:shopTabEmojis') },
          ]}
        />
        <CoinBadge amount={coins} />
      </div>
      <div className={styles.body}>
        {sub === 'crates' && <CratesTab />}
        {sub === 'boards' && (
          <div className={styles.boardsLayout}>
            <FeaturedBoard />
            <div className={styles.boardsGridCol}>
              <SectionKicker>{t('nav:shopTabBoards')}</SectionKicker>
              <div className={styles.boardGrid}>
                {ALL_BOARD_THEMES.map((theme) => (
                  <BoardTile key={theme} theme={theme} />
                ))}
              </div>
            </div>
          </div>
        )}
        {(sub === 'pieces' || sub === 'emojis') && <ComingSoonTab />}
      </div>
    </div>
  );
}
