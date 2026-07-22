import React from 'react';
import { FlappyGameHub } from '@/components/games/flappy-bird/FlappyGameHub';
import { Game2048 } from '@/components/games/Game2048';
import { Minesweeper } from '@/components/games/Minesweeper';

export interface GameDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  type: 'singleplayer' | 'multiplayer';
  href: string;
  component?: React.ComponentType<any>;
}

export const GAMES_REGISTRY: Record<string, GameDefinition> = {
  'flappy-bird': {
    id: 'flappy-bird',
    title: 'Flappy Bird',
    description: 'Flap your wings, dodge pipes, and set the ultimate high score in solo or multiplayer.',
    icon: '🐤',
    color: 'from-amber-400 to-yellow-600',
    type: 'singleplayer',
    href: '/dashboard/games/flappy-bird',
    component: FlappyGameHub
  },
  '2048': {
    id: '2048',
    title: '2048',
    description: 'Slide tiles and merge them to reach 2048. A simple but addictive puzzle game.',
    icon: '🔢',
    color: 'from-yellow-500 to-orange-600',
    type: 'singleplayer',
    href: '/dashboard/games/2048',
    component: Game2048
  },
  'minesweeper': {
    id: 'minesweeper',
    title: 'Minesweeper',
    description: 'Clear the board without detonating any hidden mines. Use logic to figure out where they are.',
    icon: '💣',
    color: 'from-red-500 to-rose-700',
    type: 'singleplayer',
    href: '/dashboard/games/minesweeper',
    component: Minesweeper
  },
  'bluff': {
    id: 'bluff',
    title: 'Bluff Card Game',
    description: 'Card game of lies, deception, and challenges. Get rid of your cards and catch other players bluffing!',
    icon: '🃏',
    color: 'from-emerald-500 to-teal-700',
    type: 'multiplayer',
    href: '/dashboard/games/bluff'
  },
  'memory-match': {
    id: 'memory-match',
    title: 'Memory Match',
    description: 'Flip cards, find matching pairs, and outscore your opponents in this classic multiplayer memory game!',
    icon: '🧠',
    color: 'from-violet-500 to-fuchsia-700',
    type: 'multiplayer',
    href: '/dashboard/games/memory-match'
  },
  'dots-and-boxes': {
    id: 'dots-and-boxes',
    title: 'Dots and Boxes',
    description: 'Connect the dots, close the boxes, and capture the board in this classic strategy game!',
    icon: '✏️',
    color: 'from-blue-500 to-indigo-700',
    type: 'multiplayer',
    href: '/dashboard/games/dots-and-boxes'
  },
  'color-wars': {
    id: 'color-wars',
    title: 'Chain Reaction',
    description: 'Place energy strategically, trigger explosive chain reactions, and capture the board to eliminate your opponents!',
    icon: '💥',
    color: 'from-rose-500 to-red-600',
    type: 'multiplayer',
    href: '/dashboard/games/color-wars'
  },
  'scribble': {
    id: 'scribble',
    title: 'Scribble',
    description: 'Draw, guess, and win! The ultimate multiplayer drawing party game.',
    icon: '🎨',
    color: 'from-sky-400 to-indigo-600',
    type: 'multiplayer',
    href: '/dashboard/games/scribble'
  },
  'ink-deception': {
    id: 'ink-deception',
    title: 'Ink & Deception',
    description: 'One Drawing. One Impostor. Trust No Stroke. Expose the Fake Artist or blend in and guess the secret word!',
    icon: '🖌️',
    color: 'from-slate-900 via-indigo-950 to-pink-950 border-[#FF5DA8]/20',
    type: 'multiplayer',
    href: '/dashboard/games/ink-deception'
  },
  'chamber-clash': {
    id: 'chamber-clash',
    title: 'Chamber Clash',
    description: 'Manage risk, use items, and survive the chamber in this tense 2-8 player strategy game!',
    icon: '🔫',
    color: 'from-slate-800 to-zinc-900 border-red-500/20',
    type: 'multiplayer',
    href: '/dashboard/games/chamber-clash'
  }
};

export const getSinglePlayerGames = (): GameDefinition[] =>
  Object.values(GAMES_REGISTRY).filter((game) => game.type === 'singleplayer');

export const getMultiplayerGames = (): GameDefinition[] =>
  Object.values(GAMES_REGISTRY).filter((game) => game.type === 'multiplayer');

export const getGameDefinition = (id: string): GameDefinition | undefined =>
  GAMES_REGISTRY[id];
