import { GameScreen } from './components/GameScreen';
import { NewGameMenu } from './components/NewGameMenu';
import { ReviewScreen } from './components/ReviewScreen';
import { useGameStore } from './features/game/gameStore';
import { useReviewStore } from './features/review/reviewStore';

export function App() {
  const reviewing = useReviewStore((s) => s.status !== 'idle');
  const inMenu = useGameStore((s) => s.status === 'menu');
  if (reviewing) return <ReviewScreen />;
  return inMenu ? <NewGameMenu /> : <GameScreen />;
}
