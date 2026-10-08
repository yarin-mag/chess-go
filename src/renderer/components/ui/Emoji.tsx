import type { CSSProperties } from 'react';
import type { PieceType } from '@/core/types';
import { pieceImage } from '../pieceImages';
import { ANCH, emojiScene } from '@/features/emoji/emojiScenes';
import type { EmojiActor, EmojiEyeStyle, EmojiFx, EmojiMouthStyle, EmojiUnder } from '@/features/emoji/emojiTypes';
import styles from './Emoji.module.css';

const px = (v: number) => `${v}px`;
const INK = '#1a1220';

function EyeShape({ style: eyeStyle, fontSize }: { style: EmojiEyeStyle; fontSize: number }) {
  switch (eyeStyle) {
    case 'big':
      return (
        <div className={styles.eyeBig}>
          <div className={styles.eyeBigPupil} />
        </div>
      );
    case 'happy':
      return <div className={styles.eyeHappy} />;
    case 'sleepy':
      return <div className={styles.eyeSleepy} />;
    case 'x':
      return (
        <div className={styles.eyeGlyph} style={{ fontSize: px(fontSize) }}>
          ×
        </div>
      );
    case 'heart':
      return (
        <div className={styles.eyeGlyph} style={{ fontSize: px(fontSize), color: 'oklch(0.62 0.23 18)' }}>
          ♥
        </div>
      );
    case 'star':
      return (
        <div className={styles.eyeGlyph} style={{ fontSize: px(fontSize), color: '#fff', textShadow: `0 0 1px ${INK},0 0 1px ${INK},0 0 5px #fff6c9` }}>
          ✦
        </div>
      );
    case 'dot':
    default:
      return <div className={styles.eyeDot} />;
  }
}

function MouthShape({ shape }: { shape: EmojiMouthStyle | undefined }) {
  switch (shape) {
    case 'grin':
      return (
        <div className={styles.mouthGrin}>
          <div className={styles.mouthGrinTeeth} />
        </div>
      );
    case 'laugh':
      return (
        <div className={styles.mouthLaugh}>
          <div className={styles.mouthLaughTeeth} />
          <div className={styles.mouthLaughTongue} />
        </div>
      );
    case 'frown':
      return <div className={styles.mouthFrown} />;
    case 'o':
      return <div className={styles.mouthO} />;
    case 'tongue':
      return (
        <>
          <div className={styles.mouthSmile} />
          <div className={styles.mouthTongue} />
        </>
      );
    case 'teeth':
      return <div className={styles.mouthTeeth} />;
    case 'smile':
    default:
      return <div className={styles.mouthSmile} />;
  }
}

function ActorFace({ actor }: { actor: EmojiActor }) {
  const [cx, cy, w] = ANCH[actor.p];
  const fw = actor.s * w;
  const fh = fw * 0.8;
  const fs = fw * 0.42;
  const shades = actor.eyes === 'shades';

  return (
    <div
      className={styles.face}
      style={{ left: px(actor.s * cx - fw / 2), top: px(actor.s * cy - fh / 2), width: px(fw), height: px(fh) }}
    >
      {actor.blush && (
        <>
          <div className={styles.blush} style={{ left: '-6%' }} />
          <div className={styles.blush} style={{ left: '82%' }} />
        </>
      )}
      {!shades && (
        <>
          <div className={styles.eyeSlot} style={{ left: '8%' }}>
            <EyeShape style={actor.eyes ?? 'dot'} fontSize={fs} />
          </div>
          <div className={styles.eyeSlot} style={{ left: '62%' }}>
            <EyeShape style={actor.eyeR ?? actor.eyes ?? 'dot'} fontSize={fs} />
          </div>
        </>
      )}
      {shades && (
        <>
          <div className={styles.shades}>
            <div className={styles.shadesLens} />
            <div className={styles.shadesLens} />
          </div>
          <div className={styles.shadesBridge} />
        </>
      )}
      {actor.angry && (
        <>
          <div className={styles.browAngryLeft} />
          <div className={styles.browAngryRight} />
        </>
      )}
      {actor.worried && (
        <>
          <div className={styles.browWorriedLeft} />
          <div className={styles.browWorriedRight} />
        </>
      )}
      <div className={styles.mouthSlot}>
        <MouthShape shape={actor.m} />
      </div>
      {actor.tears && (
        <>
          <div className={styles.tear} style={{ left: '18%' }} />
          <div className={styles.tear} style={{ left: '68%' }} />
        </>
      )}
    </div>
  );
}

function ActorView({ actor }: { actor: EmojiActor }) {
  const transform = `rotate(${actor.rot || 0}deg)${actor.flip ? ' scaleX(-1)' : ''}`;
  const filter = `brightness(0.86) sepia(1) saturate(${actor.sat ?? 4.5}) hue-rotate(${actor.h - 80}deg) brightness(1.08)`;
  const style: CSSProperties = { left: px(actor.x), top: px(actor.y), width: px(actor.s), height: px(actor.s), transform, opacity: actor.op ?? 1 };

  return (
    <div className={styles.actor} style={style}>
      <img src={pieceImage('w', actor.p.toLowerCase() as PieceType)} alt="" className={styles.actorImg} style={{ filter }} />
      {actor.face !== false && <ActorFace actor={actor} />}
    </div>
  );
}

function UnderGlow({ under }: { under: EmojiUnder }) {
  return (
    <div
      className={styles.under}
      style={{ left: px(under.x), top: px(under.y), width: px(under.w), height: px(under.h), background: `radial-gradient(closest-side, ${under.c}, transparent)` }}
    />
  );
}

function FxMark({ fx }: { fx: EmojiFx }) {
  const wrapperStyle: CSSProperties = { left: px(fx.x), top: px(fx.y), transform: `rotate(${fx.rot || 0}deg)` };
  const color = fx.c || '#fff';
  const width = px(fx.w || 10);

  switch (fx.t) {
    case 'text':
      return (
        <div className={styles.fx} style={wrapperStyle}>
          <span className={styles.fxText} style={{ fontSize: px(fx.fs || 20), color }}>
            {fx.v || ''}
          </span>
        </div>
      );
    case 'drop':
      return (
        <div className={styles.fx} style={wrapperStyle}>
          <div className={styles.fxDrop} style={{ width, height: width }} />
        </div>
      );
    case 'puff':
      return (
        <div className={styles.fx} style={wrapperStyle}>
          <div className={styles.fxPuff} style={{ width, height: width }} />
        </div>
      );
    case 'flag':
      return (
        <div className={styles.fx} style={wrapperStyle}>
          <div className={styles.fxFlag}>
            <div className={styles.fxFlagPole} />
            <div className={styles.fxFlagCloth} />
          </div>
        </div>
      );
    case 'clock':
      return (
        <div className={styles.fx} style={wrapperStyle}>
          <div className={styles.fxClock} style={{ width, height: width, borderColor: color }}>
            <div className={styles.fxClockMinute} />
            <div className={styles.fxClockHour} style={{ background: color }} />
          </div>
        </div>
      );
    case 'confetti':
      return (
        <div className={styles.fx} style={wrapperStyle}>
          <div className={styles.fxConfetti}>
            {CONFETTI_PIECES.map((c, i) => (
              <div key={i} className={styles.fxConfettiPiece} style={{ left: c.left, top: c.top, background: c.color, transform: `rotate(${c.rot}deg)` }} />
            ))}
          </div>
        </div>
      );
    case 'arrow':
      return (
        <div className={styles.fx} style={wrapperStyle}>
          <div className={styles.fxArrow} style={{ width }}>
            <div className={styles.fxArrowShaft} style={{ background: color }} />
            <div className={styles.fxArrowHead} style={{ borderLeftColor: color }} />
          </div>
        </div>
      );
    default:
      return null;
  }
}

const CONFETTI_PIECES = [
  { left: '6px', top: '8px', color: 'oklch(0.80 0.15 85)', rot: 25 },
  { left: '84px', top: '14px', color: 'oklch(0.72 0.17 300)', rot: -30 },
  { left: '18px', top: '30px', color: 'oklch(0.78 0.14 195)', rot: -15 },
  { left: '88px', top: '44px', color: 'oklch(0.72 0.19 5)', rot: 40 },
  { left: '2px', top: '56px', color: 'oklch(0.78 0.15 150)', rot: 60 },
  { left: '62px', top: '2px', color: 'oklch(0.72 0.19 5)', rot: 10 },
];

interface Props {
  kind: string;
  size: number;
}

/** Renders one "chess moment" scene from the Round 3 emoji sheet — a recolored piece (or two) wearing a
 *  CSS-built face, plus decorative marks (sweat, text, arrows, confetti…). Faithful port of the design
 *  handoff's Emoji.dc.html renderer: same data (emojiScenes.ts), same positioning math, translated from
 *  its template-string styles to React/CSS-module ones. An unrecognized `kind` falls back to a default
 *  scene rather than rendering nothing (see emojiScene()). */
export function Emoji({ kind, size }: Props) {
  const scene = emojiScene(kind);
  const k = size / 100;

  return (
    <div className={styles.frame} style={{ width: px(size), height: px(size) }}>
      <div className={styles.scene} style={{ transform: `scale(${k})` }}>
        {scene.u?.map((u, i) => <UnderGlow key={i} under={u} />)}
        {scene.a.map((a, i) => (
          <ActorView key={i} actor={a} />
        ))}
        {scene.f?.map((fx, i) => <FxMark key={i} fx={fx} />)}
      </div>
    </div>
  );
}
