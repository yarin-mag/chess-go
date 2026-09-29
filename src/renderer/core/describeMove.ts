import { t } from '@/i18n';
import { ChessGame } from './chessGame';
import type { MoveInput, MoveRecord, PieceType } from './types';

const PIECE_KEY: Record<PieceType, string> = { p: 'pieceP', n: 'pieceN', b: 'pieceB', r: 'pieceR', q: 'pieceQ', k: 'pieceK' };
const pieceName = (piece: PieceType): string => t(`game:${PIECE_KEY[piece]}`);

// Spanish grammatical gender ("El caballo" vs "La torre", "al peón" vs "a la torre") — only the rook
// and queen are feminine. English and Hebrew have no gendered-article variants registered under these
// context suffixes, so i18next's context lookup transparently falls back to the base (ungendered) key
// for those locales; only es/game.json defines moveSimple_m/_f, moveEnPassant_m/_f, moveCaptures_mm/_mf/_fm/_ff.
const FEMININE_PIECES: Partial<Record<PieceType, true>> = { r: true, q: true };
const genderCode = (piece: PieceType): 'm' | 'f' => (FEMININE_PIECES[piece] ? 'f' : 'm');

/** Turns a played move into a beginner-friendly sentence describing what actually happened on the board. */
export function describeMove(move: MoveRecord): string {
  if (move.flags.includes('k')) return t('game:castleKingside');
  if (move.flags.includes('q')) return t('game:castleQueenside');

  const piece = pieceName(move.piece);
  let text: string;
  if (move.flags.includes('e')) {
    text = t('game:moveEnPassant', { piece, from: move.from, to: move.to, context: genderCode(move.piece) });
  } else if (move.captured) {
    text = t('game:moveCaptures', {
      piece,
      from: move.from,
      captured: pieceName(move.captured),
      to: move.to,
      context: genderCode(move.piece) + genderCode(move.captured),
    });
  } else {
    text = t('game:moveSimple', { piece, from: move.from, to: move.to, context: genderCode(move.piece) });
  }

  if (move.promotion) text += t('game:movePromotes', { piece: pieceName(move.promotion) });
  if (move.san.endsWith('#')) text += t('game:moveCheckmate');
  else if (move.san.endsWith('+')) text += t('game:moveCheckSuffix');

  return text;
}

/**
 * Describes a move that was not (or not yet) played — typically the engine's suggested best move —
 * by playing it on a throwaway copy of the position. The caller's position is never touched.
 */
export function describePotentialMove(fenBefore: string, move: MoveInput): string {
  const game = new ChessGame(fenBefore);
  const record = game.move(move);
  return record ? describeMove(record) : t('game:potentialMoveFallback', { from: move.from, to: move.to });
}
