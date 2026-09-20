import { GameScreen } from './components/GameScreen';
import { NewGameMenu } from './components/NewGameMenu';
import { useGameStore } from './features/game/gameStore';

export function App() {
  const inMenu = useGameStore((s) => s.status === 'menu');
  return inMenu ? <NewGameMenu /> : <GameScreen />;
}
