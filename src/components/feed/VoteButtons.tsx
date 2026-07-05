import { motion } from "framer-motion";
import { ArrowBigUp, ArrowBigDown } from "lucide-react";

interface VoteButtonsProps {
  score: number;
  userVote: number; // +1, -1, or 0
  onVote: (value: 1 | -1) => void;
}

export function VoteButtons({ score, userVote, onVote }: VoteButtonsProps) {
  return (
    <div className="flex items-center bg-white/5 rounded-full border border-white/5 p-0.5">
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={(e) => {
          e.stopPropagation();
          onVote(1);
        }}
        className={`p-1.5 rounded-full transition-all ${
          userVote === 1
            ? "text-orange-500 bg-orange-500/10"
            : "text-gray-400 hover:text-orange-500 hover:bg-white/5"
        }`}
        title="Upvote"
      >
        <ArrowBigUp
          className="w-4 h-4"
          fill={userVote === 1 ? "currentColor" : "none"}
        />
      </motion.button>

      <span
        className={`text-xs font-bold px-1 min-w-[2.5ch] text-center ${
          userVote === 1
            ? "text-orange-500"
            : userVote === -1
            ? "text-blue-500"
            : "text-gray-300"
        }`}
      >
        {score}
      </span>

      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={(e) => {
          e.stopPropagation();
          onVote(-1);
        }}
        className={`p-1.5 rounded-full transition-all ${
          userVote === -1
            ? "text-blue-500 bg-blue-500/10"
            : "text-gray-400 hover:text-blue-500 hover:bg-white/5"
        }`}
        title="Downvote"
      >
        <ArrowBigDown
          className="w-4 h-4"
          fill={userVote === -1 ? "currentColor" : "none"}
        />
      </motion.button>
    </div>
  );
}
