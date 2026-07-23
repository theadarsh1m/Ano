"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useScribbleStore } from '@/store/useScribbleStore';
import { useUserStore } from '@/store/useUserStore';

interface GuessChatProps {
  gameId: string;
  isDrawer: boolean;
}

export const GuessChat: React.FC<GuessChatProps> = ({ gameId, isDrawer }) => {
  const [guessInput, setGuessInput] = useState('');
  const { guessLogs, sendGuess } = useScribbleStore();
  const { id: userId } = useUserStore();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll only the internal chat container to bottom, NEVER scroll window/viewport
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [guessLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || isDrawer || !userId) return;

    sendGuess(gameId, userId, guessInput);
    setGuessInput('');
  };

  return (
    <div className="flex flex-col h-[280px] lg:h-full bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md flex-1">
      <div className="bg-black/20 p-3 border-b border-white/10">
        <h3 className="text-white font-semibold flex items-center gap-2">
          Guess Chat
        </h3>
      </div>
      
      <div ref={chatContainerRef} className="flex-1 p-3 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-[200px] max-h-[300px] lg:max-h-full">
        {guessLogs.map((log) => {
          let content = null;
          
          switch (log.type) {
            case 'correct':
              content = <div className="text-emerald-400 font-bold tracking-wide">✅ {log.nickname} guessed the word!</div>;
              break;
            case 'system':
              content = <div className="text-blue-400 font-bold italic">ℹ️ {log.guess}</div>;
              break;
            case 'warning':
              content = <div className="text-orange-400 font-bold">⚠️ {log.guess}</div>;
              break;
            case 'close':
              content = <div className="text-yellow-400 font-bold">🟡 '{log.guess}' is close!</div>;
              break;
            case 'join':
              content = <div className="text-emerald-500 font-medium">{log.nickname} joined the game.</div>;
              break;
            case 'leave':
              content = <div className="text-red-400 font-medium">{log.nickname} left the game.</div>;
              break;
            default:
              content = (
                <div>
                  <span className={log.userId === userId ? 'text-sky-300 font-bold' : 'text-gray-400 font-medium'}>
                    {log.nickname}: 
                  </span>
                  <span className="text-white ml-1 font-medium">{log.guess}</span>
                </div>
              );
              break;
          }

          return (
            <div key={log.id} className="text-sm px-2 py-1 rounded hover:bg-white/5 transition-colors">
              {content}
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-black/20 border-t border-white/10">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
            disabled={isDrawer}
            placeholder={isDrawer ? "You cannot guess while drawing" : "Type your guess here..."}
            className="flex-1 bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isDrawer || !guessInput.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-4 py-2 flex items-center justify-center disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
