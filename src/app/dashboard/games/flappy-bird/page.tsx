import { Suspense } from 'react';
import { FlappyGameHub } from '@/components/games/flappy-bird/FlappyGameHub';

export const metadata = {
  title: 'Flappy Bird | Ano Arcade',
  description: 'Fly, dodge pipes, and compete in singleplayer or real-time multiplayer Flappy Bird.'
};

export default function FlappyBirdPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen text-white/50">
          Loading Flappy Bird...
        </div>
      }
    >
      <FlappyGameHub />
    </Suspense>
  );
}
