import { GameScreen } from './components/GameScreen';
import { NewGameMenu } from './components/NewGameMenu';
import { OpeningExplorerScreen } from './components/OpeningExplorerScreen';
import { PuzzleMapScreen } from './components/PuzzleMapScreen';
import { PuzzleScreen } from './components/PuzzleScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { WeaknessDashboardScreen } from './components/WeaknessDashboardScreen';
import { useGameStore } from './features/game/gameStore';
import { useOpeningExplorerStore } from './features/openings/openingExplorerStore';
import { useWeaknessDashboardStore } from './features/history/weaknessDashboardStore';
import { usePuzzleStore } from './features/puzzle/puzzleStore';
import { useReviewStore } from './features/review/reviewStore';

export function App() {
  const reviewing = useReviewStore((s) => s.status !== 'idle');
  const puzzleStatus = usePuzzleStore((s) => s.status);
  const exploringOpenings = useOpeningExplorerStore((s) => s.visible);
  const viewingStats = useWeaknessDashboardStore((s) => s.visible);
  const inMenu = useGameStore((s) => s.status === 'menu');
  const exitPuzzle = usePuzzleStore((s) => s.exit);
  const hideOpeningExplorer = useOpeningExplorerStore((s) => s.hide);
  const hideWeaknessDashboard = useWeaknessDashboardStore((s) => s.hide);

  if (reviewing) return <ReviewScreen />;
  if (puzzleStatus === 'map') return <PuzzleMapScreen onExit={exitPuzzle} />;
  if (puzzleStatus !== 'idle') return <PuzzleScreen onExit={exitPuzzle} />;
  if (exploringOpenings) return <OpeningExplorerScreen onExit={hideOpeningExplorer} />;
  if (viewingStats) return <WeaknessDashboardScreen onExit={hideWeaknessDashboard} />;
  return inMenu ? <NewGameMenu /> : <GameScreen />;
}
