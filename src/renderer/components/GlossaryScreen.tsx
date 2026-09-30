import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GLOSSARY_KEYS } from '@/features/glossary/glossaryTerms';
import styles from './GlossaryScreen.module.css';

interface Props {
  onExit: () => void;
}

export function GlossaryScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const entries = useMemo(
    () => GLOSSARY_KEYS.map((key) => ({ key, term: t(`glossary:term_${key}`), definition: t(`glossary:def_${key}`) })),
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    // Matches against the resolved (translated) term/definition text, never the raw term_* key — a
    // Hebrew or Spanish player searching in their own language must be able to find terms.
    return entries.filter((e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q));
  }, [entries, query]);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>{t('common:glossary')}</h1>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common:glossarySearch')}
        />
        <div className={styles.list}>
          {filtered.length === 0 && <p className={styles.empty}>{t('common:glossaryEmpty')}</p>}
          {filtered.map((e) => (
            <div key={e.key} className={styles.entry}>
              <p className={styles.term}>{e.term}</p>
              <p className={styles.definition}>{e.definition}</p>
            </div>
          ))}
        </div>
        <button className="btn" onClick={onExit}>
          {t('common:menu')}
        </button>
      </div>
    </div>
  );
}
