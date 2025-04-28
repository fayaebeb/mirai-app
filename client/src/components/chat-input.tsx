import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UseMutationResult } from "@tanstack/react-query";
import { Message } from "@shared/schema";

// Component for selecting emotion/prompt buttons
interface EmotionButtonsProps {
  onSelect: (message: string) => void;
  onClose: () => void;
}

interface Prompt {
  text: string;
  message?: string;
  description: string;
}

interface PromptCategory {
  name: string;
  icon: JSX.Element;
  prompts: Prompt[];
}

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  sendMessage: UseMutationResult<Message, Error, string>;
  promptCategories: PromptCategory[];
  EmotionButtons: React.FC<EmotionButtonsProps>;
  handleEmotionSelect: (text: string) => void;
}

export const ChatInput = ({
  input,
  setInput,
  handleSubmit,
  sendMessage,
  promptCategories,
  EmotionButtons,
  handleEmotionSelect,
}: ChatInputProps) => {
  const [showEmotions, setShowEmotions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 p-2 sm:p-3 border border-blue-900/30 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md w-full max-w-[92%] sm:max-w-[85%] md:max-w-[75%] rounded-xl shadow-lg shadow-black/20"
      >
        <AnimatePresence>
          {showEmotions && (
            <div className="absolute bottom-full left-0 w-full flex justify-center mb-2">
              <EmotionButtons onSelect={handleEmotionSelect} onClose={() => setShowEmotions(false)} />
            </div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 items-end">
          <div className="relative flex-1 min-w-0">
            <Textarea
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              placeholder="ミライに何かお手伝いできますか？..."
              className="pr-10 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-xs sm:text-sm min-h-[40px] max-h-[180px] resize-none py-2 px-3 bg-slate-800/50 border-blue-900/30 placeholder:text-blue-400/50 rounded-xl"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            {/* Prompt suggestions button - enhanced with animation */}
            <TooltipProvider key="prompt-tooltip">
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    className="absolute right-3 top-2 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-blue-900/40"
                    whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowEmotions((prev) => !prev)}
                  >
                    <Lightbulb className="h-4 w-4" />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-800 border border-blue-500/30">
                  <p>プロンプト一覧</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Enhanced send button with loading animation */}
          <motion.button
            type="submit"
            disabled={sendMessage.isPending || !input.trim()}
            className={`px-3 sm:px-4 py-2 h-10 rounded-xl text-white flex items-center gap-1.5 flex-shrink-0 transition-all ${
              input.trim() 
                ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50" 
                : "bg-slate-700/50 text-slate-400"
            }`}
            whileHover={input.trim() ? { scale: 1.03 } : {}}
            whileTap={input.trim() ? { scale: 0.97 } : {}}
          >
            {sendMessage.isPending ? (
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span className="text-xs hidden sm:inline font-medium">送信する</span>
                {input.trim() && (
                  <motion.span
                    className="absolute -top-1 -right-1 text-xs"
                    animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    ⚡
                  </motion.span>
                )}
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
};