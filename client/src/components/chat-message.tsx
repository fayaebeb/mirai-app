import { Message as MessageType } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui/avatar";
import { Card } from "./ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Database, Globe, Cpu, Server } from "lucide-react";
import { Button } from "./ui/button";
import { SaveChatAsNote } from "./save-chat-as-note";

// Extended Message type that includes the regenerate function
interface Message extends MessageType {
  onRegenerateAnswer?: () => void;
}

// Futuristic decorative elements to randomly add to bot messages
const botDecorations = [
  "⚡", "🔹", "💠", "🔷", "🔌", "📡", "🛰️", "⚙️", "🔋", "💻"
];

// Helper function to add decorations to bot messages
const addRandomDecoration = (original: string) => {
  if (Math.random() > 0.3) return original;
  const decoration = botDecorations[Math.floor(Math.random() * botDecorations.length)];
  const position = Math.floor(Math.random() * 3);
  if (position === 0) return `${decoration} ${original}`;
  if (position === 1) return `${original} ${decoration}`;
  return `${decoration} ${original} ${decoration}`;
};

// Helper function to parse message content into sections
const parseMessageContent = (content: string) => {
  const sections = {
    mainText: "",
    companyDocs: "",
    onlineInfo: ""
  };

  // Split by company docs marker
  const [beforeCompanyDocs, afterCompanyDocs = ""] = content.split("### 社内文書情報:");
  sections.mainText = beforeCompanyDocs.trim();

  // Split remaining content by online info marker
  const [companyDocs, onlineInfo = ""] = afterCompanyDocs.split("### オンラインWeb情報:");
  sections.companyDocs = companyDocs.trim();
  sections.onlineInfo = onlineInfo.trim();

  return sections;
};

const MessageSection = ({ 
  title, 
  content, 
  icon: Icon 
}: { 
  title: string; 
  content: string; 
  icon: React.ComponentType<any>; 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!content) return null;

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen}
      className="mt-2 rounded-md border border-blue-400/20 overflow-hidden transition-all duration-200 w-full"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between py-1 px-1.5 hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-3 w-3 text-blue-400" />
            <span className="text-xs font-mono text-blue-300">{title}</span>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3 w-3 text-blue-400" />
          </motion.div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-2 bg-slate-900/50 backdrop-blur-sm w-full"
          style={{ width: '100%' }}
        >
          <div className="prose prose-xs prose-invert max-w-none w-full text-[10px] sm:text-xs">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => (
                  <p className="w-full block text-white my-1.5 whitespace-normal text-left" style={{width: '100%'}} {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto w-full max-w-full -mx-2 px-2">
                    <table className="text-[10px] sm:text-[11px] border-collapse w-full table-fixed" {...props} />
                  </div>
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-blue-400/30 px-1 py-0.5 sm:px-2 sm:py-1 break-words" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="border border-blue-400/50 bg-slate-800 px-1 py-0.5 sm:px-2 sm:py-1 break-words" {...props} />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default function ChatMessage({ message }: { message: Message }) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiPosition, setEmojiPosition] = useState({ x: 0, y: 0 });
  const [decoration, setDecoration] = useState<string | null>(null);

  useEffect(() => {
    if (message.isBot && Math.random() > 0.7) {
      setDecoration(botDecorations[Math.floor(Math.random() * botDecorations.length)]);
    }
  }, [message.isBot]);

  const handleBotMessageHover = () => {
    if (message.isBot) {
      setShowEmoji(true);
      setEmojiPosition({
        x: Math.random() * 40 - 20,
        y: -20 - Math.random() * 20,
      });
      setTimeout(() => setShowEmoji(false), 1000);
    }
  };

  // Parse message content if it's a bot message
  const sections = message.isBot ? parseMessageContent(message.content) : null;

  return (
    <div
      className={cn("flex w-full relative", {
        "justify-end mt-4 mb-2": !message.isBot,
        "justify-start mt-5 mb-3 pr-1 sm:pr-3": message.isBot
      })}
    >
      {showEmoji && message.isBot && (
        <motion.div
          className="absolute text-base sm:text-lg z-10"
          style={{
            left: message.isBot ? "2rem" : "auto",
            right: message.isBot ? "auto" : "2rem",
            top: "0",
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
          animate={{
            x: emojiPosition.x,
            y: emojiPosition.y,
            opacity: [0, 1, 0],
            scale: [0.5, 1.2, 0.8],
            rotate: [-5, 5, -5],
          }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          {Math.random() > 0.5 ? <Server size={16} /> : <Cpu size={16} className="text-blue-400" />}
        </motion.div>
      )}

      {message.isBot && decoration && (
        <motion.div 
          className="absolute -top-2 sm:-top-3 -left-1 text-xs sm:text-sm text-blue-400"
          animate={{ 
            y: [0, -3, 0],
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.2, 1],
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        >
          {decoration}
        </motion.div>
      )}

      {message.isBot && (
        <Avatar className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 border border-blue-500/50 shadow-lg bg-slate-900">
          <motion.div
            whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
            transition={{ rotate: { duration: 0.5 } }}
          >
            <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-slate-900 border border-blue-500/30">
              <img
                src="/images/mirai.png"
                alt="Bot Logo"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
          </motion.div>
        </Avatar>
      )}


      <motion.div
        initial={message.isBot ? { x: -10, opacity: 0 } : { x: 10, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={message.isBot ? { scale: 1.02 } : { scale: 1 }}
        onHoverStart={handleBotMessageHover}
        className={cn("rounded-xl", {
          "w-auto max-w-[85%] ml-auto flex justify-end": !message.isBot,
          "w-full max-w-full flex-1 flex justify-start ml-2 sm:ml-3": message.isBot,
        })}
      >
        <Card
          className={cn(
            "px-2.5 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs overflow-hidden",
            {
              "bg-blue-600 text-white border border-blue-500/50 shadow-md hover:shadow-lg w-auto inline-block": !message.isBot,
              "bg-slate-900/90 backdrop-blur-md text-white border border-blue-400/30 shadow-md hover:shadow-lg w-full flex-1 flex flex-col": message.isBot,
            }
          )}
        >
          {/* Futuristic tech pattern overlay */}
          {message.isBot && (
            <div className="absolute inset-0 opacity-5 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full" 
                style={{ 
                  backgroundImage: `
                    radial-gradient(circle at 10% 20%, rgba(30, 64, 255, 0.2) 0%, transparent 20%),
                    radial-gradient(circle at 90% 80%, rgba(30, 64, 255, 0.2) 0%, transparent 20%),
                    linear-gradient(60deg, transparent 0%, rgba(30, 64, 255, 0.1) 100%)
                  `,
                  backgroundSize: '100% 100%'
                }}
              />
            </div>
          )}

          <div className={cn("prose prose-xs break-words leading-relaxed text-[11px] sm:text-xs w-full", {
            "prose-invert": true,
            "flex flex-col items-stretch": message.isBot,
            "w-auto max-w-full": !message.isBot
          })}>
            {message.isBot && sections ? (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, ...props }) => (
                      <p className="w-full block text-white my-1.5 whitespace-normal text-left" style={{width: '100%'}} {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto w-full max-w-full -mx-2 px-2">
                        <table className="text-[10px] sm:text-[11px] border-collapse w-full table-fixed" {...props} />
                      </div>
                    ),
                    td: ({ node, ...props }) => (
                      <td className="border border-blue-400/30 px-1 py-0.5 sm:px-2 sm:py-1 break-words" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th className="border border-blue-400/50 bg-slate-800 px-1 py-0.5 sm:px-2 sm:py-1 break-words" {...props} />
                    ),
                  }}
                >
                  {sections.mainText}
                </ReactMarkdown>

                {/* Source sections */}
                <div className="space-y-2">
                  {sections.companyDocs && (
                    <MessageSection
                      title="社内文書情報"
                      content={sections.companyDocs}
                      icon={Database}
                    />
                  )}

                  {sections.onlineInfo && (
                    <MessageSection
                      title="オンラインWeb情報"
                      content={sections.onlineInfo}
                      icon={Globe}
                    />
                  )}
                </div>
              </>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ node, ...props }) => (
                    <p className="w-full block text-white my-1.5 whitespace-normal text-left" style={{width: '100%'}} {...props} />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto w-full max-w-full -mx-2 px-2">
                      <table className="text-[10px] sm:text-[11px] border-collapse w-full table-fixed" {...props} />
                    </div>
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-blue-400/30 px-1 py-0.5 sm:px-2 sm:py-1 break-words" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-blue-400/50 bg-slate-800 px-1 py-0.5 sm:px-2 sm:py-1 break-words" {...props} />
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>

          <div className="flex justify-between items-center mt-1">
            <div className="flex items-center gap-2">
              {message.isBot && (
                <>
                  <button 
                    onClick={() => message.onRegenerateAnswer && message.onRegenerateAnswer()}
                    className="text-[9px] sm:text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 16h5v5" />
                    </svg>
                    再生成
                  </button>

                  <SaveChatAsNote message={message} />
                </>
              )}
            </div>
            {message.timestamp && (
              <div className="text-[9px] sm:text-[10px] text-blue-300/70 font-mono ml-auto">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}