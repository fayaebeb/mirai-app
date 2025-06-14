import { useState, useEffect, useRef, useMemo } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart, Lightbulb, FileText } from "lucide-react";
import { Message } from "@shared/schema";
import { nanoid } from "nanoid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ChatMessage from "./chat-message";
import { ScrollArea } from "./ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { ChatLoadingIndicator } from "./chat-loading-indicator";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { promptCategories } from "@/components/starter-prompts";
import { Badge } from "@/components/ui/badge";

// Define a type for optimistic messages that uses string IDs instead of numbers
type OptimisticMessage = {
  id: string;
  userId: number;
  content: string;
  isBot: boolean;
  timestamp: Date;
  sessionId: string;
};

// Array of cute emoji mood indicators for the network status
const onlineEmojis = ["⚙️", "🔋", "🔌", "📡", "📱", "🤖"];
const offlineEmojis = ["😴", "💤", "🥱", "🌙", "☁️"];

// Helper to get random emoji
const getRandomEmoji = (emojiArray: string[]) => {
  return emojiArray[Math.floor(Math.random() * emojiArray.length)];
};

const Tutorial = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState(1);
  const steps = [
    {
      title: "ようこそ！",
      description:
        "「ミライ」は、PCKKにおいて、情報提供や質問への回答を行うAIです。私の役割は、さまざまなトピックについて正確で分かりやすい情報を提供し、ユーザーのリクエストに的確にお応えすることです。たとえば、データに基づくご質問には、社内資料や外部情報を参照しながら丁寧にお答えします。",
      icon: <Sparkles className="h-5 w-5 text-pink-400" />,
    },
    {
      title: "楽しくお話ししましょう！",
      description:
        "「ミライ」は、OpenAIの生成モデル「GPT-4o」を使用しています。社内の全国うごき統計に関する営業資料や、人流に関する社内ミニ講座の内容を基礎データとして取り込み、さらにWikipediaやGoogleのAPIを通じてインターネット上の情報も収集しています。これらの情報をもとに、最適な回答を生成しています。",
      icon: <Heart className="h-5 w-5 text-red-400" />,
    },
  ];

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-card mx-4 sm:mx-0 rounded-xl max-w-sm w-full p-4 relative"
        initial={{ y: 50, scale: 0.9 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 15 }}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-accent transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2">
            {steps[step - 1].icon}
            <h2 className="text-lg font-semibold">{steps[step - 1].title}</h2>
          </div>
          <p className="mt-3 text-muted-foreground text-sm">
            {steps[step - 1].description}
          </p>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            スキップ
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
              >
                前へ
              </Button>
            )}
            {step < steps.length ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                次へ
              </Button>
            ) : (
              <Button size="sm" onClick={onClose}>
                始める
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Array of prompts that users can quickly select
interface Prompt {
  text: string;
  message?: string;
  description: string;
}

// Component for selecting emotion/prompt buttons
interface EmotionButtonsProps {
  onSelect: (message: string) => void;
  onClose: () => void;
}

const EmotionButtons = ({ onSelect, onClose }: EmotionButtonsProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    promptCategories[0].name,
  );

  // Handle clicks outside the emotion buttons to close it
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.target as Node)
    ) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedCategoryData =
    promptCategories.find((cat) => cat.name === selectedCategory) ||
    promptCategories[0];

  return (
    <motion.div
      ref={containerRef}
      className="bg-card shadow-lg rounded-xl border overflow-hidden w-full max-w-md"
      initial={{ y: 20, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {/* Category selector */}
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

      {/* Prompt buttons */}
      <div className="grid grid-cols-1 gap-1 p-2 max-h-60 overflow-y-auto">
        {selectedCategoryData.prompts.map((prompt, index) => (
          <motion.button
            type="button" // Prevents default submit behavior
            key={index}
            className="flex flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              onSelect(prompt.message || prompt.text);
              onClose();
            }}
          >
            <span className="font-medium text-sm">{prompt.text}</span>
            <span className="text-xs text-muted-foreground mt-0.5">
              {prompt.description}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

interface ChatInterfaceProps {
  input?: string;
  setInput?: (input: string) => void;
  handleSubmit?: (e: React.FormEvent) => void;
  sendMessageMutation?: UseMutationResult<
    Message,
    Error,
    { content: string; useWeb: boolean; useDb: boolean },
    { previousMessages?: Message[] }
  >;
  handleEmotionSelect?: (text: string) => void;
  onClearChat?: () => void;
  useWeb?: boolean;
  useDb?: boolean;
}

export const ChatInterface = ({
  input: externalInput,
  setInput: externalSetInput,
  handleSubmit: externalHandleSubmit,
  sendMessageMutation: externalSendMessageMutation,
  handleEmotionSelect: externalHandleEmotionSelect,
  useWeb = false,
  useDb = false,
}: ChatInterfaceProps = {}) => {
  const [input, setInputInternal] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showEmotions, setShowEmotions] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Use either the external or internal state and functions
  const setInput = externalSetInput || setInputInternal;
  const currentInput = externalInput !== undefined ? externalInput : input;

  // Check if online periodically
  useEffect(() => {
    const checkOnline = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", checkOnline);
    window.addEventListener("offline", checkOnline);

    // Set initial status
    checkOnline();

    return () => {
      window.removeEventListener("online", checkOnline);
      window.removeEventListener("offline", checkOnline);
    };
  }, []);

  // Show tutorial on first visit
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("hasSeenChatTutorial");
    if (!hasSeenTutorial && user) {
      setShowTutorial(false); // Disable tutorial for now
      localStorage.setItem("hasSeenChatTutorial", "true");
    }
  }, [user]);

  // Fetch previous messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    enabled: !!user,
  });

  // Clear chat history mutation
  const clearChatHistory = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/messages");
      return response.json();
    },
    onSuccess: () => {
      // Clear the messages in the query cache
      queryClient.setQueryData<Message[]>(["/api/messages"], []);

      // Close the confirmation dialog
      setShowClearConfirm(false);

      // Show success toast
      toast({
        title: "チャット履歴をクリアしました",
        description: "すべてのメッセージが削除されました。",
      });

      // Ensure UI refreshes and scrolls to empty state properly
      setTimeout(() => {
        if (messageEndRef.current) {
          messageEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    },
    onError: (error) => {
      console.error("Error clearing chat history:", error);
      toast({
        title: "エラーが発生しました",
        description: "チャット履歴のクリアに失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Handle clear chat button click
  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  // Effect to handle initial display and make header always visible on mobile
  useEffect(() => {
    // Force scroll to top on component mount
    window.scrollTo(0, 0);

    // Function to ensure header is visible on mobile devices
    const ensureHeaderVisible = () => {
      const header = document.querySelector(".chat-header");
      if (header && header instanceof HTMLElement) {
        // Set visibility directly through style
        header.style.opacity = "1";
        header.style.visibility = "visible";
        header.style.display = "flex";

        // Fix position (ensure it stays fixed at top)
        header.style.position = "sticky";
        header.style.top = "0";
      }
    };

    // Run immediately and set a timer for after load
    ensureHeaderVisible();

    // Run multiple times to catch various render/painting issues
    const timers = [
      setTimeout(ensureHeaderVisible, 100),
      setTimeout(ensureHeaderVisible, 500),
      setTimeout(ensureHeaderVisible, 1000),
    ];

    // Also run on resize events
    window.addEventListener("resize", ensureHeaderVisible);

    // Clean up timers and event listener
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", ensureHeaderVisible);
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, messageEndRef]);

  // Updated function to insert prompt text at the current position
  const handleEmotionSelect =
    externalHandleEmotionSelect ||
    ((text: string) => {
      // Simply append the text to the current input when there's no proper cursor positioning
      setInput(currentInput + text);
    });

  // Define type for grouped messages
  type MessageGroup = {
    sender: "user" | "bot";
    messages: Message[];
    lastTimestamp: Date;
  };

  // Group messages by sender to enable better visualization and collapsing
  const groupedMessages = useMemo(() => {
    if (!messages.length) return [];

    return messages.reduce((groups: MessageGroup[], message) => {
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && (lastGroup.sender === "bot") === message.isBot) {
        // Same sender as previous message group - add to existing group
        lastGroup.messages.push(message);
        lastGroup.lastTimestamp = new Date(message.timestamp);
      } else {
        // Different sender - create a new group
        groups.push({
          sender: message.isBot ? "bot" : "user",
          messages: [message],
          lastTimestamp: new Date(message.timestamp),
        });
      }

      return groups;
    }, []);
  }, [messages]);

  // Common quick replies/suggestions based on conversation context
  const quickReplies = [
    { text: "詳細を教えて", icon: <Sparkles className="h-3 w-3" /> },
    { text: "例を示して", icon: <Lightbulb className="h-3 w-3" /> },
    { text: "まとめて", icon: <FileText className="h-3 w-3" /> },
  ];

  // Handle quick reply selection
  const handleQuickReplySelect = (text: string) => {
    setInput(text);
    // No need to focus on input as it's handled in the separated component
  };

  // Get random status message
  const getStatusMessage = () => {
    const messages = [
      "接続完了",
      "データリンク確立",
      "ライブ接続",
      "メモリ最適化完了",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  // Network status with emoji
  const networkStatus = isOnline ? (
    <span className="flex items-center gap-1 text-[10px] text-blue-400">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
      {getRandomEmoji(onlineEmojis)} {getStatusMessage()}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[10px] text-red-400">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400"></span>
      {getRandomEmoji(offlineEmojis)} オフライン
    </span>
  );

  return (
    <Card className="w-full h-full md:max-w-[90%] mx-auto flex flex-col overflow-hidden relative border-blue-600/20 shadow-lg shadow-blue-900/10 bg-gradient-to-b from-slate-950 to-slate-900">
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      {/* Confirmation Dialog for clearing chat history */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="bg-slate-900 border border-blue-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-blue-100">
              チャット履歴をクリアしますか？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300/70">
              この操作は取り消せません。すべてのチャットメッセージがデータベースから削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-blue-500/30 hover:bg-blue-950/50 text-blue-300">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearChatHistory.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              クリア
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main chat container with auto-scroll */}
      <div className="flex-1 overflow-y-auto overscroll-none">
        <ScrollArea
          className="h-full px-1 sm:px-4 py-1 w-full overflow-auto -webkit-overflow-scrolling-touch bg-slate-900/90 backdrop-blur-md rounded-none sm:rounded-xl shadow-xl border-0 sm:border border-blue-500/20 pt-1 pb-12"
          ref={scrollAreaRef}
        >
          <div className="space-y-2 w-full max-w-full">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center sm:min-h-[300px] text-center py-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="p-6 rounded-2xl bg-blue-900/10 border border-blue-500/10 max-w-sm"
                >
                  <div className="relative mb-4 mx-auto w-14 h-14 flex items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-full border border-blue-400/30"
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.5, 0.3],
                        rotate: 360,
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                    <Sparkles className="h-10 w-10 text-blue-400" />
                  </div>

                  <h3 className="text-lg font-medium mb-2 text-blue-100">
                    対話を始めましょう
                  </h3>
                  <p className="text-blue-300/80 max-w-xs mx-auto text-sm">
                    下のテキストボックスにメッセージを入力して、
                    <br />
                    ミライと対話を開始してください
                  </p>

                  {/* New: Quick start suggestions */}
                  <div className="mt-5 space-y-2">
                    <p className="text-xs text-blue-400 font-semibold">
                      試してみる:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {promptCategories[0].prompts
                        .slice(0, 3)
                        .map((prompt, i) => (
                          <motion.button
                            key={i}
                            onClick={() =>
                              handleEmotionSelect(prompt.message || prompt.text)
                            }
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="text-xs px-3 py-1.5 rounded-full bg-blue-900/30 text-blue-300 border border-blue-500/20 hover:bg-blue-800/40 transition-colors"
                          >
                            {prompt.text}
                          </motion.button>
                        ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : (
              // Enhanced with message grouping
              groupedMessages.map((group: MessageGroup, groupIndex: number) => (
                <div key={`group-${groupIndex}`} className="mb-3">
                  {/* Messages from the same sender grouped together */}
                  <div
                    className={`flex flex-col ${group.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    {group.messages.map((message: Message, i: number) => {
                      // Find the corresponding user message for bot messages to enable regeneration
                      const lastUserMessageIndex = message.isBot
                        ? messages.findIndex((m) => m.id === message.id) - 1
                        : -1;
                      const lastUserMessage =
                        lastUserMessageIndex >= 0
                          ? messages[lastUserMessageIndex]
                          : null;

                      const handleRegenerateAnswer = () => {
                        if (lastUserMessage?.content) {
                          externalSendMessageMutation?.mutate({
                            content: lastUserMessage.content,
                            useWeb,
                            useDb,
                          });
                        }
                      };

                      // First message in a group shows the avatar
                      const isFirstInGroup = i === 0;

                      return (
                        <div
                          className={`w-full max-w-full ${i > 0 ? "mt-1" : "mt-0"}`}
                          key={
                            typeof message.id === "string"
                              ? message.id
                              : `msg-${message.id}`
                          }
                        >
                          <ChatMessage
                            message={{
                              ...message,
                              onRegenerateAnswer: message.isBot
                                ? handleRegenerateAnswer
                                : undefined,
                            }}
                            isFirstInGroup={isFirstInGroup}
                            isLastInGroup={i === group.messages.length - 1}
                          />
                        </div>
                      );
                    })}

                    {/* Timestamp shown once per group at the end */}
                    {/*<div className={`text-[9px] text-blue-400/50 font-mono mt-1 ${group.sender === 'user' ? 'mr-2' : 'ml-2'}`}>
                              {group.lastTimestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>*/}

                    {/* Quick replies after bot messages */}
                    {/* {group.sender === 'bot' && groupIndex === groupedMessages.length - 1 && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3, duration: 0.3 }}
                              className="ml-10 mt-2 flex flex-wrap gap-2"
                            >
                              {quickReplies.map((reply, i) => (
                                <motion.button
                                  key={i}
                                  onClick={() => handleQuickReplySelect(reply.text)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="text-xs px-2 py-1 rounded-full bg-blue-900/20 text-blue-400 border border-blue-500/20 hover:bg-blue-900/40 transition-colors flex items-center gap-1.5"
                                >
                                  {reply.icon}
                                  <span>{reply.text}</span>
                                </motion.button>
                              ))}
                            </motion.div>
                          )}*/}
                  </div>
                </div>
              ))
            )}

            {/* Enhanced loading state */}
            {externalSendMessageMutation?.isPending && (
              <motion.div
                className="flex justify-start pt-2 pb-4 pl-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChatLoadingIndicator
                  variant="character"
                  message="ミライが処理中..."
                />
              </motion.div>
            )}
            <div ref={messageEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input form removed and moved to a separate component */}
    </Card>
  );
};

export default ChatInterface;