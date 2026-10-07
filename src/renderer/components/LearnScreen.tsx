import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryScreen } from './GlossaryScreen';
import { OpeningExplorerScreen } from './OpeningExplorerScreen';
import { PuzzleMapScreen } from './PuzzleMapScreen';
import { SegmentedTabs } from './ui/SegmentedTabs';
import styles from './LearnScreen.module.css';

type SubTab = 'course' | 'openings' | 'glossary';

/** Learn tab: puts the Round 3 sub-tabs (Course/Openings/Glossary) above the existing puzzle ladder,
 *  opening explorer and glossary screens — their data/stores are untouched, this just picks which one
 *  is visible instead of each being a separate standalone overlay. */
export function LearnScreen() {
  const { t } = useTranslation();
  const [sub, setSub] = useState<SubTab>('course');

  return (
    <div className={styles.screen}>
      <nav className={styles.subNav}>
        <SegmentedTabs
          value={sub}
          onChange={setSub}
          options={[
            { value: 'course', label: t('nav:learnCourse') },
            { value: 'openings', label: t('nav:learnOpenings') },
            { value: 'glossary', label: t('common:glossary') },
          ]}
        />
      </nav>
      <div className={styles.body}>
        {sub === 'course' && <PuzzleMapScreen />}
        {sub === 'openings' && <OpeningExplorerScreen />}
        {sub === 'glossary' && <GlossaryScreen />}
      </div>
    </div>
  );
}
