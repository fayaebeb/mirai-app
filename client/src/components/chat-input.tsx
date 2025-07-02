import { useState, useRef, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Lightbulb, Send, Globe, Database } from "lucide-react";
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
import { promptCategories } from "@/components/prompt-categories";
import debounce from "lodash.debounce";
import VoiceRecorder from "./voice-recorder";

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e: React.FormEvent) => void;
  sendMessage: UseMutationResult<
    Message,
    Error,
    { content: string; useWeb: boolean; useDb: boolean },
    { previousMessages?: Message[] }
  >;

  useWeb: boolean;
  setUseWeb: React.Dispatch<React.SetStateAction<boolean>>;
  useDb: boolean;
  setUseDb: React.Dispatch<React.SetStateAction<boolean>>;
  handleVoiceRecording: (audio: Blob) => void;
  isProcessingVoice: boolean;

}

export const ChatInput = ({
  input,
  setInput,
  handleSubmit,
  sendMessage,
  useWeb,
  setUseWeb,
  useDb,
  setUseDb,
  isProcessingVoice,
  handleVoiceRecording,

}: ChatInputProps) => {
  const [showPrompts, setShowPrompts] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("出力形式 📄");

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const lightbulbRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const [localInput, setLocalInput] = useState(input);

  useEffect(() => {
    setLocalInput(input);
  }, [input]);

  const debouncedSetInput = useRef(
    debounce((val: string) => setInput(val), 100)
  ).current;

  const selectedCategoryData = promptCategories.find(
    (cat) => cat.name === selectedCategory
  ) || promptCategories[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showPrompts) return;

      const isClickInsidePrompt = promptRef.current?.contains(event.target as Node);
      const isClickOnLightbulb = lightbulbRef.current?.contains(event.target as Node);

      if (!isClickInsidePrompt && !isClickOnLightbulb) {
        setShowPrompts(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showPrompts]);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input]);


  const handlePromptInsert = (text: string) => {
    const textarea = inputRef.current;
    if (!textarea) {
      setInput((prev) => prev + text);
      setShowPrompts(false);
      return;
    }

    const { selectionStart: start, selectionEnd: end } = textarea;
    const newValue = input.slice(0, start) + text + input.slice(end);
    setInput(newValue);
    setShowPrompts(false);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  };

  return (
    <div className="">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl flex flex-col gap-2 rounded-2xl border border-border shadow-md bg-slate-800/90 backdrop-blur-md px-4 py-3"
      >
        {/* Input Textarea */}
        <TextareaAutosize
          ref={inputRef}
          value={localInput}
          onChange={(e) => {
            const newVal = e.target.value;
            setLocalInput(newVal);
            debouncedSetInput(newVal);
          }}
          placeholder="ミライに何かお手伝いできますか？..."
          minRows={1}
          maxRows={6}
          className="w-full resize-none bg-transparent border-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-sm text-white placeholder:text-muted-foreground px-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isMobile) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />




        {/* Button Row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {/* Prompt Selector */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    ref={lightbulbRef}
                    type="button"
                    onClick={() => setShowPrompts((prev) => !prev)}
                    className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center rounded-full p-2 hover:bg-accent/40"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Lightbulb className="h-5 w-5" />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>プロンプト一覧</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Toggle Web */}
            <button
              onClick={(e) => {
                e.preventDefault();
                setUseWeb(!useWeb);
              }}
              className={`h-8 sm:h-9 flex items-center justify-center flex-shrink-0 transition-all font-medium
                ${isMobile ? "w-8 sm:w-9 rounded-full p-0" : "px-3 py-1.5 rounded-full gap-1"}
                ${useWeb
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border border-blue-400 shadow-sm"
                  : "bg-slate-700 text-slate-300 border border-slate-600 hover:border-slate-400"
                }
                hover:ring-1 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70
              `}
            >
              <Globe className="h-4 w-4" />
              {!isMobile && <span className="hidden sm:inline">オンライン</span>}
            </button>

            {/* Toggle DB */}
            <button
              onClick={(e) => {
                e.preventDefault();
                setUseDb(!useDb);
              }}
              className={`h-8 sm:h-9 flex items-center justify-center flex-shrink-0 transition-all font-medium
                ${isMobile ? "w-8 sm:w-9 rounded-full p-0" : "px-3 py-1.5 rounded-full gap-1"}
                ${useDb
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white border border-purple-500 shadow-sm"
                  : "bg-slate-700 text-slate-300 border border-slate-600 hover:border-slate-400"
                }
                hover:ring-1 hover:ring-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/70
              `}
            >
              <Database className="h-4 w-4" />
              {!isMobile && <span className="hidden sm:inline">データ</span>}
            </button>
            
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecording}
              isProcessing={isProcessingVoice}
            />
          </div>

          {/* Send Button */}
          <motion.button
            type="submit"
            disabled={sendMessage.isPending || !input.trim()}
            className={`relative px-3 sm:px-4 py-2 h-10 rounded-xl text-white flex items-center gap-1.5 flex-shrink-0 transition-all
              ${input.trim()
                ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50"
                : "bg-slate-700/50 text-slate-400 cursor-not-allowed"
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

      {/* Prompt Dropdown */}
      <AnimatePresence>
        {showPrompts && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-[110px] w-full flex justify-center px-4"
          >
            <div
              ref={promptRef}
              onClick={(e) => e.stopPropagation()}
              className="bg-card shadow-lg rounded-xl border overflow-hidden w-full max-w-md"
            >
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
              <div className="grid grid-cols-1 gap-1 p-2 max-h-60 overflow-y-auto">
                {selectedCategoryData.prompts.map((prompt, index) => (
                  <motion.button
                    key={index}
                    type="button"
                    className="flex flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePromptInsert(prompt.message || prompt.text)}
                  >
                    <span className="font-medium text-sm">{prompt.text}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {prompt.description}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
