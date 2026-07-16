"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool } from 'lucide-react';
import { useScribbleStore } from '@/store/useScribbleStore';
import { useUserStore } from '@/store/useUserStore';

export const WordSelectionModal: React.FC = () => {
  const { gameState, selectWord } = useScribbleStore();
  const { id: userId } = useUserStore();
  const [timeLeft, setTimeLeft] = useState(15);

  const isDrawer = gameState?.currentDrawerId === userId;
  const isWaitingForWord = gameState?.turnState === 'WAITING_FOR_WORD';

  useEffect(() => {
    if (isWaitingForWord) {
      // Sync with server time loosely
      setTimeLeft(gameState.drawingTimeLeft);
      const interval = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isWaitingForWord, gameState?.drawingTimeLeft]);

  if (!gameState || !isWaitingForWord) return null;

  const handleSelect = (word: string) => {
    if (isDrawer && userId) {
      selectWord(gameState.gameId, userId, word);
    }
  };

  return (
    <AnimatePresence>
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-neutral-900 border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative overflow-hidden"
        >
          {/* Progress bar background */}
          <div 
            className="absolute bottom-0 left-0 h-1 bg-sky-500 transition-all ease-linear"
            style={{ width: `${(timeLeft / 15) * 100}%`, transitionDuration: '1s' }}
          />

          <div className="w-16 h-16 bg-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <PenTool className="w-8 h-8 text-sky-400" />
          </div>

          {isDrawer ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">Choose a word</h2>
              <p className="text-gray-400 mb-6">Select a word to draw for the other players to guess.</p>
              
              <div className="flex flex-col gap-3">
                {gameState.wordChoices?.map((word, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(word)}
                    className="w-full py-3 px-4 bg-white/5 hover:bg-sky-500 hover:text-white border border-white/10 rounded-xl text-white font-medium transition-all text-lg tracking-wide hover:shadow-lg hover:shadow-sky-500/20 hover:-translate-y-0.5"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </>
          ) : (
            (() => {
              const drawer = gameState.players.find(p => p.userId === gameState.currentDrawerId);
              const drawerName = drawer ? drawer.nickname : 'Drawer';
              return (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2">Waiting for {drawerName}</h2>
                  <p className="text-gray-400 mb-6">
                    {drawerName} is choosing a word. Get ready to guess!
                  </p>
                  
                  <div className="flex justify-center items-center h-24">
                     <div className="flex gap-2">
                       <div className="w-3 h-3 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                       <div className="w-3 h-3 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                       <div className="w-3 h-3 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                     </div>
                  </div>
                </>
              );
            })()
          )}
          
          <div className="mt-6 text-sm text-gray-500 font-mono">
            {timeLeft}s remaining
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
