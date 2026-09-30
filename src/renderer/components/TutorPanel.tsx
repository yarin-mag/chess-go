import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeMove, describePotentialMove } from '@/core/describeMove';
import { summarizeGame } from '@/features/review/summarizeGame';
import { useReviewStore } from '@/features/review/reviewStore';
import { phraseFor, reasonFor } from '@/engine/explain';
import { EvalBar } from './EvalBar';
import { ReasonModal } from './ReasonModal';
import styles from './TutorPanel.module.css';

/** A move name with a toggle that reveals its plain-English meaning ("The knight on b8 moves to c6."). */
function ExpandableMove({ label, san, detail }: { label: string; san: string; detail: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.moveRow}>
      <p className={styles.moveLine}>
        {label} <strong>{san}</strong>
        <button className={styles.expandBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? t('tutor:collapse') : t('tutor:expand')}
        </button>
      </p>
      {open && <p className={styles.moveDetail}>{detail}</p>}
    </div>
  );
}

export function TutorPanel() {
  const { t } = useTranslation();
  const { analysis, index, status, progress, goTo, history } = useReviewStore();
  const current = index >= 0 ? analysis[index] : null;
  const [reasonOpen, setReasonOpen] = useState(false);
  const summary = useMemo(() => (status === 'ready' ? summarizeGame(analysis) : []), [status, analysis]);

  if (status === 'analyzing') {
    const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className={styles.panel}>
        <div className={styles.analyzing}>
          <p className={styles.analyzingLabel}>
            {t('tutor:analyzing', { done: progress.done, total: progress.total })}
          </p>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.analyzingHint}>{t('tutor:analyzingHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {summary.length > 0 && (
        <div className={styles.summary}>
          {summary.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
      )}
      <div className={styles.header}>
        <span className={styles.moveNumber}>{index >= 0 ? t('tutor:moveNumber', { n: index + 1 }) : t('tutor:startPosition')}</span>
        {current && <span className={`${styles.tier} ${styles[current.tier]}`}>{t(`stats:tier_${current.tier}`)}</span>}
      </div>

      <div className={styles.body}>
        <EvalBar scoreForWhite={current ? (current.move.color === 'w' ? current.playedScore : -current.playedScore) : 0} />
        <div className={styles.text}>
          {current?.opening && (
            <p className={styles.opening}>
              {current.opening.eco} · {current.opening.name}
            </p>
          )}
          {current ? (
            <>
              <ExpandableMove key={`played-${current.ply}`} label={t('tutor:played')} san={current.move.san} detail={describeMove(current.move)} />
              <p className={styles.tagLine}>
                {current.tags.map((tag, i) => phraseFor(tag, current.tier, current.move.san, current.ply + i)).join(' ')}
                <button className={styles.whyBtn} onClick={() => setReasonOpen(true)}>
                  {t('common:why')}
                </button>
              </p>
              {current.tier !== 'best' && current.tier !== 'brilliant' && (
                <ExpandableMove
                  key={`best-${current.ply}`}
                  label={t('tutor:bestWas')}
                  san={current.bestSan}
                  detail={describePotentialMove(current.fenBefore, current.bestMove)}
                />
              )}
            </>
          ) : (
            <p>{t('tutor:startPositionHint')}</p>
          )}
        </div>
      </div>

      <div className={styles.nav}>
        <button className="btn" disabled={index <= -1} onClick={() => goTo(index - 1)}>
          {t('tutor:prev')}
        </button>
        <button className="btn" disabled={index >= history.length - 1} onClick={() => goTo(index + 1)}>
          {t('tutor:next')}
        </button>
      </div>

      {current && (
        <ReasonModal
          open={reasonOpen}
          onClose={() => setReasonOpen(false)}
          title={t('tutor:whyTitle', { san: current.move.san })}
          text={current.tags.map((tag, i) => reasonFor(tag, current.tier, current.move.san, current.ply + i)).join(' ')}
        />
      )}
    </div>
  );
}
