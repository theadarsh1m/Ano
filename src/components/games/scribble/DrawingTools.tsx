"use client";

import React from 'react';
import { Trash2, Eraser, Pen, Undo2, Redo2, PaintBucket } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DrawingToolsProps {
  isDrawer: boolean;
  selectedColor: string;
  setSelectedColor: (c: string) => void;
  selectedSize: number;
  setSelectedSize: (s: number) => void;
  selectedTool: 'brush' | 'eraser' | 'fill';
  setSelectedTool: (t: 'brush' | 'eraser' | 'fill') => void;
  onClear: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff',
  '#c0c0c0', '#808080', '#800000', '#808000', '#008000', '#800080', '#008080', '#000080',
  '#ff7f50', '#ff8c00', '#ffd700', '#32cd32', '#00ced1', '#1e90ff', '#9370db', '#ff1493'
];

const SIZES = [2, 5, 10, 20];

export const DrawingTools: React.FC<DrawingToolsProps> = ({
  isDrawer,
  selectedColor,
  setSelectedColor,
  selectedSize,
  setSelectedSize,
  selectedTool,
  setSelectedTool,
  onClear,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}) => {
  if (!isDrawer) {
    return (
      <div className="w-full bg-black/20 border-t border-white/10 p-4 flex items-center justify-center backdrop-blur-md">
        <p className="text-white/60 text-sm italic">You are guessing. Watch the drawer closely!</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-black/40 border-t border-white/10 p-3 flex flex-col sm:flex-row items-center justify-center gap-4 backdrop-blur-md h-full">
      {/* Colors */}
      <div className="flex flex-wrap gap-1 border-r border-white/10 pr-4">
        {COLORS.map(color => (
          <button
            key={color}
            onClick={() => {
              setSelectedColor(color);
              if (selectedTool === 'eraser') setSelectedTool('brush');
            }}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${
              selectedColor === color && selectedTool !== 'eraser' ? 'border-white scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Tools */}
      <div className="flex gap-2 border-r border-white/10 pr-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedTool('brush')}
          className={`${selectedTool === 'brush' ? 'bg-white/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
          title="Pencil / Brush"
        >
          <Pen className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedTool('fill')}
          className={`${selectedTool === 'fill' ? 'bg-white/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
          title="Bucket Fill"
        >
          <PaintBucket className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedTool('eraser')}
          className={`${selectedTool === 'eraser' ? 'bg-white/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
          title="Eraser"
        >
          <Eraser className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          className="text-gray-400 hover:text-white disabled:opacity-30"
          title="Undo"
        >
          <Undo2 className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          className="text-gray-400 hover:text-white disabled:opacity-30"
          title="Redo"
        >
          <Redo2 className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="text-gray-400 hover:text-red-400"
          title="Clear Canvas"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>

      {/* Sizes */}
      <div className="flex items-center gap-3">
        {SIZES.map(size => (
          <button
            key={size}
            onClick={() => setSelectedSize(size)}
            className={`rounded-full bg-white transition-all flex items-center justify-center ${
              selectedSize === size ? 'ring-2 ring-emerald-400' : 'opacity-60 hover:opacity-100'
            }`}
            style={{ width: size + 4, height: size + 4 }}
          />
        ))}
      </div>
    </div>
  );
};
