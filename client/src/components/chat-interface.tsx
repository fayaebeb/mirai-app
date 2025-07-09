import { useState, useEffect, useRef, useMemo } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart, Lightbulb, FileText, Trash2, Download, X, Menu } from "lucide-react";
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
import { Trefoil } from 'ldrs/react'
import 'ldrs/react/Trefoil.css'
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
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { currentAudioUrlAtom, isPlayingAudioAtom, isProcessingVoiceAtom, playingMessageIdAtom } from "@/states/voicePlayerStates";
import { activeChatIdAtom } from "@/states/chatStates";
import { Spotlight } from "./ui/spotlight";
import { useSidebar } from "./ui/sidebar";
import { ChatPDFExport } from "./chat-pdf-export";
import { activeTabState } from "@/states/activeTabState";

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
  const [isProcessingVoice, setIsProcessingVoice] = useRecoilState(isProcessingVoiceAtom);
  const [isPlayingAudio, setIsPlayingAudio] = useRecoilState(isPlayingAudioAtom);
  const [playingMessageId, setPlayingMessageId] = useRecoilState(playingMessageIdAtom);
  const [currentAudioUrl, setCurrentAudioUrl] = useRecoilState(currentAudioUrlAtom);
  const activeChatId = useRecoilValue(activeChatIdAtom)

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
  const {
    data: messages = [],
    isLoading: isLoadingMsgs,
    error: msgsError,
  } = useQuery<Message[]>({
    queryKey: ["/api/chats", activeChatId, "messages"],          // 👈 unique per chat
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/chats/${activeChatId}/messages`);
      if (!res.ok) throw new Error("メッセージの取得に失敗しました。");
      return res.json() as Promise<Message[]>;
    },
    enabled: !!activeChatId,                                     // run only when a chat is selected
    staleTime: 0,                                                // always refetch on focus
  });


  // Handle clear chat button click
  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  const clearChatHistory = useMutation<void, Error>({
    // 1️⃣ No parameters — we read activeChatId from closure
    mutationFn: async () => {
      if (activeChatId === null) {
        throw new Error("チャットが選択されていません。");
      }
      const res = await apiRequest(
        "DELETE",
        `/api/chats/${activeChatId}/messages`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "チャット履歴のクリアに失敗しました。");
      }
    },

    // 2️⃣ Clear only the active chat’s cache on success
    onSuccess: () => {
      const key: [string, number, string] = [
        "/api/chats",
        activeChatId!,
        "messages",
      ];
      queryClient.setQueryData<Message[]>(key, []);
      queryClient.invalidateQueries({ queryKey: key });

      setShowClearConfirm(false);
      toast({
        title: "チャット履歴をクリアしました",
        description: "すべてのメッセージが削除されました。",
      });
    },

    onError: (error) => {
      console.error("Error clearing chat history:", error);
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    if (messageEndRef.current && messages.length !== 0) {
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

  // Group messages by sender for better visualization / collapsing
  const groupedMessages = useMemo(() => {
    if (!messages.length) return [];

    return messages.reduce((groups: MessageGroup[], message) => {
      const lastGroup = groups[groups.length - 1];

      // make sure we have a Date object (API may return ISO string)
      const msgTime = message.createdAt
        ? message.createdAt instanceof Date
          ? message.createdAt
          : new Date(message.createdAt)
        : new Date(); // fallback for optimistic rows

      if (lastGroup && (lastGroup.sender === "bot") === message.isBot) {
        // Same sender → append
        lastGroup.messages.push(message);
        lastGroup.lastTimestamp = msgTime;
      } else {
        // New sender → start new group
        groups.push({
          sender: message.isBot ? "bot" : "user",
          messages: [message],
          lastTimestamp: msgTime,
        });
      }
      return groups;
    }, []);
  }, [messages]);

  // Common quick replies/suggestions based on conversation context
  const quickReplies = [
    { text: "詳細を教えて", icon: <Sparkles className="h-4 w-4" /> },
    { text: "例を示して", icon: <Lightbulb className="h-4 w-4" /> },
    { text: "まとめて", icon: <FileText className="h-4 w-4" /> },
  ];

  const [drawerOpen, setDrawerOpen] = useState(false);

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


  const playMessageAudio = async (messageId: number, text: string) => {
    // If the same message is already playing, toggle it off
    if (isPlayingAudio && playingMessageId === messageId) {
      setIsPlayingAudio(false);
      setPlayingMessageId(null);
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        setCurrentAudioUrl(null);
      }
      return;
    }

    try {
      setIsPlayingAudio(true);
      setPlayingMessageId(messageId);

      // Show a toast to indicate audio is being prepared
      toast({
        title: "音声生成中...",
        description: "音声を準備しています。しばらくお待ちください。",
        duration: 2000,
      });

      const res = await fetch('/api/voice/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`Failed to fetch TTS stream: ${res.status} ${errorText}`);
      }

      if (!res.body) {
        throw new Error("Response body is null");
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            totalLength += value.length;
          }
        }
      } catch (readError) {
        console.error("Error reading stream:", readError);
        throw new Error("音声データの読み込み中にエラーが発生しました。");
      }

      // Make sure we got some data
      if (totalLength === 0) {
        throw new Error("No audio data received");
      }

      const audioData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }

      const audioBlob = new Blob([audioData], { type: "audio/wav" });
      if (audioBlob.size === 0) {
        throw new Error("Empty audio blob created");
      }

      // Revoke any previously active audio URL
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      setCurrentAudioUrl(audioUrl);

      toast({
        title: "音声準備完了",
        description: "音声の再生を開始します。",
        duration: 1500,
      });
    } catch (error) {
      console.error("TTS Error:", error);
      toast({
        title: "音声生成エラー",
        description: error instanceof Error ?
          `音声を生成できませんでした: ${error.message}` :
          "音声を生成できませんでした。",
        variant: "destructive",
      });
      setIsPlayingAudio(false);
      setPlayingMessageId(null);
      // Clean up any partial resources
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        setCurrentAudioUrl(null);
      }
    }
  };

  const { open } = useSidebar()
  const setActiveTab = useSetRecoilState(activeTabState)

  if (isLoadingMsgs) {
    return (
      <div
        style={{
          "--scroll-area-track-bg": "transparent",
          "--scroll-area-thumb-bg": "transparent",
          "--scroll-area-thumb-hover-bg": "transparent",
        } as React.CSSProperties}
        className="h-full" >
        <div className=" flex flex-col items-center justify-center h-full px-4   md:py-0 md:px-40 z-10 space-y-4">
          <Spotlight />

          <Trefoil
            size="60"
            stroke="4"
            strokeLength="0.15"
            bgOpacity="0.1"
            speed="1.4"
            color="#f2f2f2"
          />
          <h1 className="text-5xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50">読み込み中</h1>
        </div>
      </div>
    )
  }

  return (


    <div
      style={{
        "--scroll-area-track-bg": "transparent",
        "--scroll-area-thumb-bg": "transparent",
        "--scroll-area-thumb-hover-bg": "transparent",
      } as React.CSSProperties}
      className="h-full" >

      {
        messages.length === 0 ? (

          <div className=" flex flex-col items-center justify-center h-full px-4   md:py-0 md:px-40 z-10">
            <Spotlight />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col space-y-4 items-center justify-center h-full "
            >
              <div className="">
                <motion.div
                  className=""
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
                <Sparkles className="h-10 w-10 text-black" />
              </div>

              <h3 className="text-2xl md:text-5xl font-medium mb-2 text-noble-black-100">
                対話を始めましょう
              </h3>
              <p className="text-noble-black-300/80 max-w-xs mx-auto text-sm text-center">
                下のテキストボックスにメッセージを入力して、
                <br />
                ミライと対話を開始してください
              </p>

              {/* New: Quick start suggestions */}
              <div className="mt-5 space-y-2">
                <p className="text-xs text-black font-semibold text-center">
                  プロジェクト:
                </p>
                <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-5">

                  <motion.button
                    onClick={() => setActiveTab("voice")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-black border  z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm  p-5"
                  >
                    ボイスモッド
                  </motion.button>
                  <motion.button
                    onClick={() => setActiveTab("notes")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                  >
                    メモ
                  </motion.button>
                  <motion.button
                    onClick={() => setActiveTab("mindmap")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                  >
                    マインドマップ
                  </motion.button>
                  <motion.button
                    onClick={() => setActiveTab("goals")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                  >
                    ゴール
                  </motion.button>

                </div>
              </div>
              <div className="mt-5 space-y-2 w-full">
                <p className="text-xs text-black font-semibold text-center">
                  試してみる:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 md:gap-y-0 md:gap-x-5">
                  {promptCategories[0].prompts.slice(0, 3).map((prompt, i) => (
                    <motion.button
                      key={i}
                      onClick={() => handleEmotionSelect(prompt.message || prompt.text)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="
        box-border        
        min-w-0           
        w-full            
        bg-black border z-20 border-noble-black-100/20
        hover:bg-gradient-to-br text-noble-black-400
        rounded-lg shadow-md text-sm
        p-2 md:p-5        
        break-words      
      "
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
            <div key={`group-${groupIndex}`} className="mb-3 overflow-y-auto">
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
                      className={`w-full max-w-full ${i > 0 ? "mt-1" : "mt-10"}`}
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
                        isPlayingAudio={isPlayingAudio}
                        playingMessageId={playingMessageId}
                        onPlayAudio={playMessageAudio}
                      />
                    </div>
                  );
                })}

                {/* Timestamp shown once per group at the end */}
                {/* <div className={`text-[9px] text-noble-black-100 font-mono mt-1 ${group.sender === 'user' ? 'mr-2' : 'ml-2'}`}>
                  {group.lastTimestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div> */}

                {/* Quick replies after bot messages */}
                <div className="relative xl:hidden">
                  {group.sender === "bot" &&
                    groupIndex === groupedMessages.length - 1 && (
                      <motion.div

                        className="fixed top-6 right-5 z-20 flex justify-center px-4 space-x-2 "
                      >

                        {messages.length > 0 && (
                          <Button
                            variant="ghost"
                            onClick={handleClearChat}
                            className="text-noble-black-100 hover:text-noble-black-900 bg-black border border-noble-black-900 shadow-black shadow-2xl hover:bg-noble-black-100 flex items-center gap-1 p-2 rounded-full"
                          >
                            <Trash2 className="h-4 w-4 text-noble-black-100" />
                            <span className="hidden sm:inline">チャット履歴をクリア</span>
                          </Button>
                        )}


                        {quickReplies.map((reply, i) => (
                          <motion.button
                            key={i}
                            onClick={() => handleQuickReplySelect(reply.text)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center shadow-black shadow-2xl space-x-1.5 rounded-full border border-noble-black-900 bg-white px-3 py-0.5 text-xs font-medium text-noble-black-900 hover:bg-black hover:text-white transition-colors"
                          >
                            {reply.icon}
                            <span className="hidden md:flex">{reply.text}</span>
                          </motion.button>
                        ))}


                        {messages.length > 0 && (
                          <ChatPDFExport
                            messages={messages}
                            triggerContent={
                              <>
                                <Download className="h-4 w-4 " />
                                <span className="hidden sm:flex">エクスポート</span>
                              </>
                            }
                            triggerClassName="
                      
                    "
                          />
                        )}

                      </motion.div>
                    )}
                </div>

                <div className="relative xl:flex hidden">
                  {/* only show when bot is done speaking */}
                  {group.sender === "bot" && groupIndex === groupedMessages.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, x: drawerOpen ? -250 : (open ? 64 : 16) }}
                      animate={{ opacity: 1, y: 0, x: drawerOpen ? -250 : (open ? 64 : 16) }}
                      exit={{ opacity: 0, y: 5, x: drawerOpen ? -250 : (open ? 64 : 16) }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="fixed top-6 left-0 right-0  z-20 flex justify-center items-center px-4 space-x-2 "
                    >
                      <div className="relative flex items-center z-30">
                        {/* DRAWER TOGGLE */}
                        <motion.button
                          onClick={() => setDrawerOpen((o) => !o)}
                          animate={{ x: drawerOpen ? -8 : 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className="text-noble-black-100 hover:text-noble-black-900 bg-black border border-noble-black-900 shadow-black shadow-2xl hover:bg-noble-black-100 flex items-center gap-1 p-2.5  rounded-full"
                        >
                          {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </motion.button>

                        {/* SLIDING PANEL */}
                        <AnimatePresence>
                          {drawerOpen && (
                            <motion.div
                              initial={{ opacity: 0, x: 10, width: 0 }}
                              animate={{ opacity: 1, x: 0, width: "100rem" }}
                              exit={{ opacity: 0, x: 10, width: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                              className="absolute left-full top-0 flex items-center space-x-2 overflow-hidden z-20"
                            >
                              {/* 1) Clear Chat */}
                              {messages.length > 0 && (
                                <Button
                                  variant="ghost"
                                  onClick={handleClearChat}
                                  className="text-noble-black-100 hover:text-noble-black-900 bg-black border border-noble-black-900 shadow-black shadow-2xl hover:bg-noble-black-100 flex items-center gap-1 p-2  xl:px-3 xl:py-1 rounded-full"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="hidden xl:flex">チャット履歴をクリア</span>
                                </Button>
                              )}

                              {/* 2) Quick Replies */}
                              {quickReplies.map((reply, i) => (
                                <motion.button
                                  key={i}
                                  onClick={() => handleQuickReplySelect(reply.text)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="text-noble-black-100 hover:text-noble-black-900 bg-black border border-noble-black-900 shadow-black shadow-2xl hover:bg-noble-black-100 flex items-center gap-x-1 p-2  xl:px-3 xl:py-1 rounded-full"
                                >
                                  {reply.icon}
                                  <span className="hidden xl:flex">{reply.text}</span>
                                </motion.button>
                              ))}

                              {/* 3) PDF Export */}
                              {messages.length > 0 && (
                                <ChatPDFExport
                                  messages={messages}
                                  triggerContent={
                                    <>
                                      <Download className="h-4 w-4" />
                                      <span className="hidden xl:flex">エクスポート</span>
                                    </>
                                  }
                                  triggerClassName=""
                                />
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </div>


              </div>
            </div>
          ))
        )
      }

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

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="mx-auto max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl p-6 bg-black text-noble-black-100 border border-noble-black-900">

          <AlertDialogHeader>
            <AlertDialogTitle className="text-noble-black-100">チャット履歴をクリアしますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-noble-black-300">
              この操作は取り消せません。すべてのチャット履歴が削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-noble-black-900 text-noble-black-100  hover:bg-noble-black-800 border-0 hover:text-noble-black-100">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearChatHistory.mutate()}
              disabled={!activeChatId}
              className="bg-noble-black-100  text-noble-black-900 border border-noble-black-900 hover:text-noble-black-100"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
};

export default ChatInterface;