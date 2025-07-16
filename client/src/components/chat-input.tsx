import { useState, useRef, useEffect, useCallback } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Lightbulb, Send, Globe, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { UseMutationResult } from "@tanstack/react-query";
import { DbType, Message } from "@shared/schema";
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
import DbButton from "./dbbutton";

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e: React.FormEvent) => void;
  sendMessage: UseMutationResult<
    Message,
    Error,
    { content: string; useWeb: boolean; useDb: boolean, dbType: DbType },
    { previousMessages?: Message[] }
  >;

  useWeb: boolean;
  setUseWeb: React.Dispatch<React.SetStateAction<boolean>>;
  useDb: boolean;
  setUseDb: React.Dispatch<React.SetStateAction<boolean>>;
  handleVoiceRecording: (audio: Blob) => void;
  isProcessingVoice: boolean;
  selectedDb: DbType;
  setSelectedDb: React.Dispatch<React.SetStateAction<DbType>>;
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
  selectedDb,
  setSelectedDb,
  isProcessingVoice,
  handleVoiceRecording,

}: ChatInputProps) => {
  const [showPrompts, setShowPrompts] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("出力形式 📄");
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const lightbulbRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const [localInput, setLocalInput] = useState(input);

  useEffect(() => {
    if (!isComposing) {
      setLocalInput(input);
    }
  }, [input, isComposing]);

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
    <div className="w-full px-0.5 pb-0.5 md:pb-0 md:px-0 md:w-fit  flex items-center justify-center relative z-[49]">
      <form
        onSubmit={handleSubmit}
        className="  w-full md:min-w-[40rem] flex flex-col gap-2 rounded-2xl border border-noble-black-800 shadow-md bg-black/90 backdrop-blur-md px-4 py-3"
      >
        {/* Input Textarea */}
        <TextareaAutosize
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(e) => {
            setIsComposing(false);
            // flush final IME text immediately
            setInput(e.currentTarget.value);
          }}
          ref={inputRef}
          value={localInput}
          onChange={(e) => {
            const v = e.target.value;
            setLocalInput(v);
            // only debounce out-of-IME
            if (!isComposing) {
              debouncedSetInput(v);
            }
          }}
          placeholder="ミライに何かお手伝いできますか？..."
          minRows={1}
          maxRows={6}
          spellCheck={false}
          autoComplete="off" // Disable browser autocomplete
          autoCorrect="off" // Disable autocorrect
          className="w-full resize-none bg-transparent border-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-sm text-white placeholder:text-muted-foreground px-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isMobile) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />




        {/* Button Row */}
        <div className="flex items-center justify-between flex-wrap gap-2 ">
          <div className="flex items-center gap-2">
            {/* Prompt Selector */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    ref={lightbulbRef}
                    type="button"
                    onClick={() => setShowPrompts((prev) => !prev)}
                    className="bg-noble-black-900 text-noble-black-300  border-slate-600 hover:border-slate-400 flex items-center justify-center rounded-full p-2 hover:bg-rose-600/40 hover:text-rose-400"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Lightbulb className="h-4 w-4" />
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
                  ? "bg-cyan-600/40 text-cyan-400 border border-blue-400 shadow-sm"
                  : "bg-noble-black-900 text-noble-black-300  hover:border-slate-400"
                }
                hover:ring-1 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70
              `}
            >
              <Globe className="h-4 w-4" />
              {!isMobile && <span className="hidden sm:inline">オンライン</span>}
            </button>

            {/* Toggle DB */}
            {/* <button
              onClick={(e) => {
                e.preventDefault();
                setUseDb(!useDb);
              }}
              className={`h-8 sm:h-9 flex items-center justify-center flex-shrink-0 transition-all font-medium
                ${isMobile ? "w-8 sm:w-9 rounded-full p-0" : "px-3 py-1.5 rounded-full gap-1"}
                ${useDb
                  ? "bg-fuchsia-600/40 text-fuchsia-400 border border-purple-500 shadow-sm"
                  : "bg-noble-black-900 text-noble-black-300 "
                }
                hover:ring-1 hover:ring-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/70
              `}
            >
              <Database className="h-4 w-4" />
              {!isMobile && <span className="hidden sm:inline">データ</span>}
            </button> */}

            <DbButton
              useDb={useDb}
              setUseDb={setUseDb}
              selectedDb={selectedDb}
              setSelectedDb={setSelectedDb}
            />

            <VoiceRecorder
              onRecordingComplete={handleVoiceRecording}
              isProcessing={isProcessingVoice}
            />
          </div>

          {/* Send Button */}
          <motion.button
            type="submit"
            disabled={sendMessage.isPending || !input.trim()}
            className={`relative disabled:text-noble-black-100  disabled:bg-noble-black-900 px-3 sm:px-4 py-2 h-10 rounded-xl text-noble-black-100 flex items-center gap-1.5 flex-shrink-0 transition-all
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


        {/* Prompt Dropdown */}
        <AnimatePresence>
          {showPrompts && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-[125px] w-full md:w-fit left-0 flex justify-center border border-noble-black-800 shadow-md bg-black/90 backdrop-blur-md rounded-2xl overflow-hidden z-[49]"
            >
              <div
                ref={promptRef}
                onClick={(e) => e.stopPropagation()}
                className=" shadow-lg bg-black/90 backdrop-blur-md overflow-hidden w-full max-w-md z-[999]"
              >
                <div className="flex  p-2 gap-1 overflow-x-auto scrollbar-hide border-b border-noble-black-800">
                  {promptCategories.map((category) => (
                    <Button
                      key={category.name}
                      type="button"
                      variant={selectedCategory === category.name ? "default" : "ghost"}
                      size="sm"
                      className={`whitespace-nowrap text-xs flex items-center gap-1.5  w-1/2 ${selectedCategory === category.name ? "bg-noble-black-900" : ""}`}
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      {category.icon}
                      <span>{category.name}</span>
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-1 p-2 max-h-60 overflow-y-auto z-[49]">
                  {selectedCategoryData.prompts.map((prompt, index) => (
                    <motion.button
                      key={index}
                      type="button"
                      className="flex flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-accent hover:text-noble-black-900 transition-colors "
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePromptInsert(prompt.message || prompt.text)}
                    >
                      <span className="font-medium text-sm text-noble-black-100 hover:text-noble-black-900">{prompt.text}</span>
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
      </form>

    </div>
  );
};
