import { GameScreen } from './components/GameScreen';
import { NewGameMenu } from './components/NewGameMenu';
import { PuzzleMapScreen } from './components/PuzzleMapScreen';
import { PuzzleScreen } from './components/PuzzleScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { useGameStore } from './features/game/gameStore';
import { usePuzzleStore } from './features/puzzle/puzzleStore';
import { useReviewStore } from './features/review/reviewStore';

export function App() {
  const reviewing = useReviewStore((s) => s.status !== 'idle');
  const puzzleStatus = usePuzzleStore((s) => s.status);
  const inMenu = useGameStore((s) => s.status === 'menu');
  const exitPuzzle = usePuzzleStore((s) => s.exit);

  if (reviewing) return <ReviewScreen />;
  if (puzzleStatus === 'map') return <PuzzleMapScreen onExit={exitPuzzle} />;
  if (puzzleStatus !== 'idle') return <PuzzleScreen onExit={exitPuzzle} />;
  return inMenu ? <NewGameMenu /> : <GameScreen />;
}
