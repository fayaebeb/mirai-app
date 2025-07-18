import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Trio } from 'ldrs/react'
import 'ldrs/react/Trio.css'
import { Mirage } from 'ldrs/react'
import 'ldrs/react/Mirage.css'
// Default values shown

import { JellyTriangle } from 'ldrs/react'
import 'ldrs/react/JellyTriangle.css'

// Default values shown


// Futuristic animations for the loading indicator
const characterVariants = {
  thinking: {
    scale: [1, 1.05, 1],
    filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  typing: {
    x: [0, -2, 0, 2, 0],
    filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  pulse: {
    boxShadow: ["0 0 5px rgba(0, 0, 0, 0.3)", "0 0 15px rgba(0, 0, 0, 0.6)", "0 0 5px rgba(0, 0, 0, 0.3)"],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

const thinkingExpressions = [
  "💭",
  "🍙",
  "🐼",
  "🫧",
  "👻",
  "🤍"
];

const thinkingMessages = [
  "データ処理中...",
  "情報検索中...",
  "アルゴリズム計算中...",
  "応答を生成中...",
  "量子演算処理中...",
];

type ChatLoadingIndicatorProps = {
  variant?: "minimal" | "character" | "dots";
  message?: string;
};

export function ChatLoadingIndicator({
  variant = "character",
  message,
}: ChatLoadingIndicatorProps) {
  const [expression, setExpression] = useState(thinkingExpressions[0]);
  const [thinkingMessage, setThinkingMessage] = useState(thinkingMessages[0]);

  // Periodically change the expressions for more dynamic animation
  useEffect(() => {
    const expressionInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * thinkingExpressions.length);
      setExpression(thinkingExpressions[randomIndex]);
    }, 2000);

    const messageInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * thinkingMessages.length);
      setThinkingMessage(thinkingMessages[randomIndex]);
    }, 3000);

    return () => {
      clearInterval(expressionInterval);
      clearInterval(messageInterval);
    };
  }, []);

  // Minimal dot animation (existing animation style)
  if (variant === "dots") {
    return (

      <Trio
        size="40"
        speed="1.3"
        color="#f2f2f2"
      />
    );
  }

  // Futuristic loading animation
  if (variant === "character") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex items-center gap-3">
          {/* Animated futuristic icon */}
          <motion.div
            className="bg-noble-black-900 text-xl p-3 rounded-lg border border-noble-black-900 shadow-lg relative overflow-hidden"
            variants={characterVariants}
            animate="thinking"
            style={{
              boxShadow: "0 0 10px rgba(0, 0, 0, 0)"
            }}
          >
            {/* Inner glowing effect */}
            <motion.div
              className="absolute inset-0 bg-black"
              animate={{
                opacity: [0.4, 0.7, 0.4]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            <JellyTriangle
              size="30"
              speed="1.75"
              color="#f2f2f2"

            />
          </motion.div>

          {/* Futuristic status indicator */}
          <div className="bg-black backdrop-blur-md px-4 py-2 rounded-md border border-noble-black-900 shadow-lg relative flex items-center">
            <span className="text-noble-black-100 font-mono text-sm mr-2">{message || thinkingMessage}</span>
            <div className="flex items-center gap-1">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-black"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-black"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-black"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              />
            </div>

            {/* Cyber connector line */}
            {/* <div className="absolute left-[-10px] top-1/2 transform -translate-y-1/2 w-10 h-[2px] bg-gradient-to-r from-transparent to-blue-400/70" /> */}
          </div>
        </div>
      </div>
    );
  }

  // Futuristic minimal loading indicator (fallback)
  return (
    <div className="flex items-center justify-center p-2">
      <div className="relative flex items-center">
        {/* <motion.div
          className="w-6 h-6 border-2 border-noble-black-900 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ boxShadow: "0 0 5px rgba(0, 0, 0, 0)" }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border border-noble-black-900"
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        /> */}


        <Mirage
          size="60"
          speed="2.5"
          color="#f2f2f2"
        />
      </div>
      {message && (
        <motion.span
          className="ml-3 text-sm font-mono text-noble-black-100"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {message}
        </motion.span>
      )}
    </div>
  );
}

// Futuristic particle animation for more decorative loading
export function SakuraPetalLoading() {
  return (
    <div className="relative h-20 w-full overflow-hidden flex items-center justify-center">
      {[...Array(8)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute"
          initial={{
            y: Math.random() * 80 - 40,
            x: Math.random() * 100 - 50,
            opacity: 0,
          }}
          animate={{
            y: Math.random() * 80 - 40,
            x: Math.random() * 100 - 50,
            opacity: [0, 0.8, 0],
            scale: [0.2, 1, 0.2],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: index * 0.2,
            ease: "easeInOut"
          }}
        >
          <div className={`h-${Math.floor(Math.random() * 3) + 1} w-${Math.floor(Math.random() * 6) + 2} bg-blue-${Math.floor(Math.random() * 3) + 4}00 rounded-full blur-sm`} />
        </motion.div>
      ))}

      {/* Glowing orb in center */}
      <motion.div
        className="absolute w-12 h-12 rounded-full bg-blue-500/20 blur-md z-0"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="z-10 bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-md shadow-lg border border-blue-400/30">
        <motion.span
          className="text-sm font-mono text-blue-400"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          読み込み中...
        </motion.span>
      </div>
    </div>
  );
}

// Export both components for flexibility
export default ChatLoadingIndicator;