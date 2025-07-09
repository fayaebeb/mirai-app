import { Message as MessageType } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui/avatar";
import { Card } from "./ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Database, Globe, Cpu, Server, Clipboard, Check, Volume2 } from "lucide-react";
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

// Helper function to parse message content into sections
const parseMessageContent = (content: string) => {
  const sections = { mainText: "", companyDocs: "", onlineInfo: "" };

  const companyMarker = "### 社内文書情報:";
  const onlineMarker = "### オンラインWeb情報:";

  const companyIndex = content.indexOf(companyMarker);
  const onlineIndex = content.indexOf(onlineMarker);

  if (companyIndex !== -1 && (onlineIndex === -1 || companyIndex < onlineIndex)) {
    sections.mainText = content.slice(0, companyIndex).trim();
    if (onlineIndex !== -1) {
      sections.companyDocs = content.slice(companyIndex + companyMarker.length, onlineIndex).trim();
      sections.onlineInfo = content.slice(onlineIndex + onlineMarker.length).trim();
    } else {
      sections.companyDocs = content.slice(companyIndex + companyMarker.length).trim();
    }
  } else if (onlineIndex !== -1) {
    sections.mainText = content.slice(0, onlineIndex).trim();
    sections.onlineInfo = content.slice(onlineIndex + onlineMarker.length).trim();
  } else {
    sections.mainText = content.trim();
  }

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
      className="mt-2 rounded-md border border-noble-black-400/20 overflow-hidden transition-all duration-200"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between py-1 px-1.5 hover:bg-noble-black-900/50 transition-colors border bg-black border-noble-black-900"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-3 w-3 text-noble-black-400" />
            <span className="text-xs font-mono text-noble-black-300">{title}</span>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3 w-3 text-noble-black-400" />
          </motion.div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-2 bg-noble-black-900 border border-black backdrop-blur-sm text-noble-black-100 "
        >
          <div className="prose prose-xs prose-invert max-w-none w-full text-[10px] sm:text-xs text-noble-black-100">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => (
                  <p className="text-noble-black-400 my-1.5" {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto w-full mx-auto pb-1 relative text-noble-black-400">
                    <div>
                      <table className="text-[10px] sm:text-[11px] border-collapse border-noble-black-500 table-auto border-spacing-0 text-noble-black-400" {...props} />
                    </div>
                  </div>
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-noble-black-400/30 px-1 py-0.5 sm:px-2 sm:py-1 break-words whitespace-normal min-w-[50px] max-w-[150px] text-noble-black-400" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="border border-noble-black-400/50 bg-noble-black-900 px-1 py-0.5 sm:px-2 sm:py-1 break-words whitespace-normal min-w-[50px] max-w-[150px] text-noble-black-400" {...props} />
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

export default function ChatMessage({
  message,
  isFirstInGroup = true,
  isLastInGroup = true,
  isPlayingAudio,
  playingMessageId,
  onPlayAudio,
}: {
  message: Message;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isPlayingAudio: boolean;
  playingMessageId: number | null;
  onPlayAudio: (messageId: number, text: string) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiPosition, setEmojiPosition] = useState({ x: 0, y: 0 });
  const [decoration, setDecoration] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(message.content);
  const contentRef = useRef(message.content);

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };


  // Only show typing animation for NEW bot messages (not existing ones on page load)
  useEffect(() => {
    // For all existing messages, display content immediately without animation
    setDisplayedContent(message.content);
    setIsTyping(false);

    // Typing animation is now handled by a separate mechanism in the chat interface
    // when new messages are received from the API
  }, [message.content]);

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
  const sections = message.isBot ? parseMessageContent(displayedContent) : null;

  // Determine message bubble styling based on position in the group
  const getBubbleStyles = () => {
    if (message.isBot) {
      return {
        borderRadius: isFirstInGroup && isLastInGroup
          ? '0.75rem'
          : isFirstInGroup
            ? '0.75rem 0.75rem 0.25rem 0.75rem'
            : isLastInGroup
              ? '0.25rem 0.75rem 0.75rem 0.75rem'
              : '0.25rem 0.75rem 0.25rem 0.75rem',
        marginTop: isFirstInGroup ? '0.375rem' : '0.125rem',
        marginBottom: isLastInGroup ? '0.375rem' : '0.125rem'
      };
    } else {
      return {
        borderRadius: isFirstInGroup && isLastInGroup
          ? '0.75rem'
          : isFirstInGroup
            ? '0.75rem 0.75rem 0.75rem 0.25rem'
            : isLastInGroup
              ? '0.75rem 0.25rem 0.75rem 0.75rem'
              : '0.75rem 0.25rem 0.25rem 0.75rem',
        marginTop: isFirstInGroup ? '0.375rem' : '0.125rem',
        marginBottom: isLastInGroup ? '0.375rem' : '0.125rem'
      };
    }
  };

  // Get message bubble styles
  const bubbleStyles = getBubbleStyles();

  return (
    <div
      className={cn("flex w-full relative overflow-visible", {
        "justify-end": !message.isBot,
        "justify-start": message.isBot,
        "mt-3": isFirstInGroup,
        "mt-0.5": !isFirstInGroup,
        "mb-0.5": !isLastInGroup,
        "mb-1": isLastInGroup,
        "md:px-2": true
      })}
    >
      {showEmoji && message.isBot && (
        <motion.div
          className="absolute text-noble-black-300 z-10"
          style={{
            left: message.isBot ? "2.5rem" : "auto",
            right: message.isBot ? "auto" : "2.5rem",
            top: "-8px",
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
          {Math.random() > 0.5 ? <Server size={14} /> : <Cpu size={14} />}
        </motion.div>
      )}

      {message.isBot && decoration && isFirstInGroup && (
        <motion.div
          className="absolute -top-2 sm:-top-3 -left-1 text-xs sm:text-sm text-noble-black-400"
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

      {/* Only show avatar for bot messages at the start of a group */}
      {message.isBot && isFirstInGroup ? (
        <Avatar className="hidden sm:flex flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 border border-noble-black-500/30 shadow-md bg-black mr-0.5 ">
          <motion.div
            whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
            transition={{ rotate: { duration: 0.5 } }}
          >
            <div className="w-full h-full rounded-full flex items-center justify-center bg-black border border-noble-black-500/20">
              <img
                src="/images/mirai.png"
                alt="AI Assistant"
                className="w-full h-full p-1 object-contain rounded-full"
              />
            </div>
          </motion.div>
        </Avatar>
      ) : message.isBot ? (
        <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 mr-0.5 bg-black border border-noble-black-500/20 rounded-full text-noble-black-100 flex items-center justify-center">み</div>
      ) : null}


      <motion.div
        initial={message.isBot ? { x: -10, opacity: 0 } : { x: 10, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={message.isBot && !isTyping ? { scale: 1.01 } : { scale: 1 }}
        onHoverStart={handleBotMessageHover}
        className={cn({
          // Bot message bubble takes full width on mobile, max 85% on sm+
          "px-2 w-full sm:max-w-[85%] flex justify-start  md:pb-0 md:pt-1 md:pr-0 md:pl-4 ": message.isBot,

          // User message stays constrained at all sizes
          "w-auto max-w-[85%] ml-auto flex justify-end p-2 md:pb-0 md:pt-1 md:pl-0 md:pr-4 ": !message.isBot,
        })}
      >

        <Card
          className={cn(
            "px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs overflow-hidden border-0",
            {
              "bg-noble-black-100  text-noble-black-900  shadow-md hover:shadow-lg w-auto inline-block": !message.isBot,
              "bg-black backdrop-blur-md text-noble-black-100  shadow-md hover:shadow-lg w-auto flex flex-col": message.isBot,
            }
          )}
          style={bubbleStyles}
        >
          {/* Enhanced futuristic tech pattern overlay for bot messages */}
          {message.isBot && (
            <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 20% 30%, rgba(0, 0, 0, 0.3) 0%, transparent 15%),
                    radial-gradient(circle at 80% 70%, rgba(0, 0, 0, 0.3) 0%, transparent 15%),
                    linear-gradient(60deg, transparent 0%, rgba(0, 0, 0, 0.1) 100%)
                  `,
                  backgroundSize: '100% 100%'
                }}
              />
              {/* Animated gradient line */}
              <motion.div
                className="absolute h-[1px] bg-gradient-to-r from-transparent via-noble-black-400/40 to-transparent"
                style={{ width: '150%', left: '-25%' }}
                animate={{
                  top: ['0%', '100%', '0%'],
                  opacity: [0, 0.5, 0],
                }}
                transition={{
                  duration: Math.random() * 5 + 10,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
            </div>
          )}

          <div className={cn("prose break-words leading-relaxed font-normal text-base sm:text-base overflow-hidden", {
            "prose-invert": true,
            "w-full min-w-0 max-w-full": message.isBot,
            "w-auto max-w-full": !message.isBot,
            "prose-p:my-1.5": true,
            "prose-pre:whitespace-pre-wrap prose-pre:break-words prose-p:text-left prose-p:text-white": message.isBot
          })}>
            {message.isBot && sections ? (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, ...props }) => (
                      <p className="text-noble-black-100 my-1.5" {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto w-full mx-auto pb-1 relative">
                        <div>
                          <table className="text-[10px] sm:text-[11px] border-collapse table-auto border-spacing-0" {...props} />
                        </div>
                      </div>
                    ),
                    td: ({ node, ...props }) => (
                      <td className="border border-noble-black-400/30 px-1 py-0.5 sm:px-2 sm:py-1 break-words whitespace-normal min-w-[50px] max-w-[150px]" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th className="border border-noble-black-400/50 bg-noble-black-900 px-1 py-0.5 sm:px-2 sm:py-1 break-words whitespace-normal min-w-[50px] max-w-[150px]" {...props} />
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
                    <p className="text-noble-black-900 my-1.5" {...props} />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto w-full mx-auto pb-1 relative">
                      <div>
                        <table className="text-[10px] sm:text-[11px] border-collapse table-auto border-spacing-0" {...props} />
                      </div>
                    </div>
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-noble-black-400/30 px-1 py-0.5 sm:px-2 sm:py-1 break-words whitespace-normal min-w-[50px] max-w-[150px]" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-noble-black-400/50 bg-noble-black-900 px-1 py-0.5 sm:px-2 sm:py-1 break-words whitespace-normal min-w-[50px] max-w-[150px]" {...props} />
                  ),
                }}
              >
                {displayedContent}
              </ReactMarkdown>
            )}

            <div id="highlighted-component-1" className="mt-2 flex items-center justify-between">
              <div className="text-[9px] sm:text-[10px] text-noble-black-400">
                {/* {message.timestamp && new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} */}

                {message.createdAt &&
                  new Date(
                    message.createdAt instanceof Date
                      ? message.createdAt
                      : (message.createdAt as string)
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}

              </div>
              {message.isBot ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 p-1 rounded-full"
                  onClick={() => onPlayAudio(message.id, message.content)}
                  disabled={isPlayingAudio && playingMessageId !== message.id}
                >
                  {isPlayingAudio && playingMessageId === message.id ? (
                    <span className="animate-pulse text-xs">■</span>
                  ) : (
                    <Volume2 className="h-4 w-4 text-noble-black-100 hover:text-noble-black-900" />
                  )}
                </Button>
              ) : null}
            </div>

            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                className="inline-flex items-center gap-1 text-noble-black-300 h-4 pl-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-1 h-1 rounded-full bg-noble-black-400 animate-pulse" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1 h-1 rounded-full bg-noble-black-400 animate-pulse" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1 h-1 rounded-full bg-noble-black-400 animate-pulse" style={{ animationDelay: "300ms" }}></div>
              </motion.div>
            )}
          </div>

          {/* Show action buttons only when last in a group */}
          {isLastInGroup && !isTyping && (
            <div className="flex justify-between items-center mt-1.5">
              <div className="flex items-center gap-2">
                {message.isBot && (
                  <>
                    <button
                      onClick={() => message.onRegenerateAnswer && message.onRegenerateAnswer()}
                      className="text-[9px] sm:text-[10px] text-noble-black-400 hover:text-blue-300 flex items-center gap-1 opacity-60 hover:opacity-100 transition-all hover:scale-105"
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

                    <button
                      onClick={handleCopy}
                      className="text-[9px] sm:text-[10px] text-noble-black-100 hover:text-blue-500 flex items-center gap-1 opacity-60 hover:opacity-100 transition-all hover:scale-105"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-3 h-3" />
                          コピー
                        </>
                      )}
                    </button>

                    <SaveChatAsNote message={message} />
                  </>
                )}
              </div>

              {/* Reaction buttons (new feature) */}
              {message.isBot && (
                <div className="flex gap-1 mr-1">
                  <motion.button
                    className="text-noble-black-100 hover:text-blue-500 transition-colors text-[10px]"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    👍
                  </motion.button>
                  <motion.button
                    className="text-noble-black-100 hover:text-blue-500 transition-colors text-[10px]"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    👎
                  </motion.button>
                </div>
              )}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}