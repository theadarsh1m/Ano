import { Suspense } from 'react';
import { PaperFallGameHub } from '@/components/games/paper-fall/PaperFallGameHub';

export const metadata = {
  title: 'PaperFall | Ano Arcade',
  description: 'Type words to fire your cannon and shred falling papers. Solo or multiplayer typing battle.'
};

export default function PaperFallPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen text-white/50">
          Loading PaperFall...
        </div>
      }
    >
      <PaperFallGameHub />
    </Suspense>
  );
}
