import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Send, MessageSquare, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { UseMutationResult } from "@tanstack/react-query";
import { Message } from "@shared/schema";
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e: React.FormEvent) => void;
  sendMessage: UseMutationResult<Message, Error, string>;
}

export const ChatInput = ({
  input,
  setInput,
  handleSubmit,
  sendMessage,
}: ChatInputProps) => {
  const [showEmotions, setShowEmotions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const lightbulbRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();
  const [selectedCategory, setSelectedCategory] = useState<string>("出力形式 📄");
  
  // Handle clicks outside to close the prompt selector
  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      // Only run if the prompt selector is open
      if (!showEmotions) return;
      
      // Check if the click was outside both the prompt container and the lightbulb button
      const isClickInsidePrompt = promptRef.current?.contains(event.target as Node);
      const isClickOnLightbulb = lightbulbRef.current?.contains(event.target as Node);
      
      // If the click is outside both elements, close the selector
      if (!isClickInsidePrompt && !isClickOnLightbulb) {
        setShowEmotions(false);
      }
    }
    
    // Use the click event instead of mousedown
    document.addEventListener('click', handleDocumentClick);
    
    // Clean up
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showEmotions]);

  const promptCategories = [
    {
      name: "出力形式 📄",
      icon: <MessageSquare className="h-4 w-4" />,
      prompts: [
        { text: "会話形式で💬", message: "AさんとBさんの会話形式で出力して", description: "フレンドリーな会話形式で回答します" },
        { text: "箇条書き形式で📝", message: "箇条書き形式で出力して", description: "箇条書き形式で出力します" },
        { text: "表形式で📊", message: "表形式で出力して", description: "表形式で出力します" },
        { text: "FAQ形式で❓", message: "FAQ形式で出力して", description: "FAQ形式で出力します" },
        { text: "比喩・たとえ話形式🎭", message: "比喩・たとえ話形式で出力して", description: "比喩・たとえ話形式で出力します" },
        { text: "簡潔に要約✨", message: "簡潔に要約で出力して", description: "簡潔に要約で出力します" },
      ],
    },
    {
      name: "アシスタント 🤖",
      icon: <Wand2 className="h-4 w-4" />,
      prompts: [
        { text: "＋指示のコツ🎯", message: "質問に対してさらに理解を深めるために、どのような指示をすればよいか提案して", description: "より良い指示の出し方をアドバイスします" },
        { text: "「外部情報なし」🚫", message: "インターネットからの情報を利用しないで", description: "外部情報を使わずに回答します" },
        { text: "初心者向け📘", message: "説明に出てくる専門用語には、それぞれ説明を加え、初心者でも理解しやすいように。具体的な例を挙げながら丁寧に解説して", description: "具体的な例を挙げながら丁寧に解説します" },
      ],
    },
  ];

  
  const selectedCategoryData = promptCategories.find(cat => cat.name === selectedCategory) || promptCategories[0];

  const handleEmotionSelect = (text: string) => {
    const textarea = inputRef.current;
    if (!textarea) {
      setInput(input + text);
      setShowEmotions(false);  // move up
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = input.slice(0, start) + text + input.slice(end);
    setInput(newValue);

    setShowEmotions(false); // 👉 Close immediately before focusing

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  };



  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 p-2 sm:p-3 border border-blue-900/30 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md w-full max-w-[92%] sm:max-w-[85%] md:max-w-[75%] rounded-xl shadow-lg shadow-black/20 relative"
      >
        {/* prompt Buttons */}
        <AnimatePresence>
          {showEmotions && (
            <motion.div       
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full left-0 w-full flex justify-center mb-2"
            >
              <div 
                ref={promptRef} 
                onClick={(e) => e.stopPropagation()} 
                className="bg-card shadow-lg rounded-xl border overflow-hidden w-full max-w-md"
              >
                {/* Category Tabs */}
                <div className="flex gap-1 p-2 bg-muted/40 overflow-x-auto scrollbar-hide">
                  {promptCategories.map((category) => (
                    <Button
                      key={category.name}
                      type="button"
                      variant={selectedCategory === category.name ? "default" : "ghost"}
                      size="sm"
                      className="whitespace-nowrap text-xs flex items-center gap-1.5"
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      {category.icon}
                      <span>{category.name}</span>
                    </Button>
                  ))}
                </div>

                {/* Prompt Buttons */}
                <div className="grid grid-cols-1 gap-1 p-2 max-h-60 overflow-y-auto">
                  {selectedCategoryData.prompts.map((prompt, index) => (
                    <motion.button
                      key={index}
                      type="button"
                      className="flex flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleEmotionSelect(prompt.message || prompt.text)}
                    >
                      <span className="font-medium text-sm">{prompt.text}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{prompt.description}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
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
              className="pl-3 pr-10 sm:pl-3 sm:pr-10 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-xs sm:text-sm min-h-[40px] max-h-[180px] resize-none py-2 bg-slate-800/50 border-blue-900/30 placeholder:text-blue-400/50 rounded-xl"

              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            {/* Lightbulb Button */}
            <TooltipProvider key="prompt-tooltip">
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    ref={lightbulbRef}
                    type="button"
                    className="absolute right-2 top-2 text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent/50"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowEmotions((prev) => !prev)}
                  >
                    <Lightbulb className="h-4 w-4" />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>プロンプト一覧</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Send Button */}
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