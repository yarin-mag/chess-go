import { GameScreen } from './components/GameScreen';
import { NewGameMenu } from './components/NewGameMenu';
import { PuzzleScreen } from './components/PuzzleScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { useGameStore } from './features/game/gameStore';
import { usePuzzleStore } from './features/puzzle/puzzleStore';
import { useReviewStore } from './features/review/reviewStore';

export function App() {
  const reviewing = useReviewStore((s) => s.status !== 'idle');
  const puzzling = usePuzzleStore((s) => s.status !== 'idle');
  const inMenu = useGameStore((s) => s.status === 'menu');
  const exitPuzzle = usePuzzleStore((s) => s.exit);

  if (reviewing) return <ReviewScreen />;
  if (puzzling) return <PuzzleScreen onExit={exitPuzzle} />;
  return inMenu ? <NewGameMenu /> : <GameScreen />;
}
