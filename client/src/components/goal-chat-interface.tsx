import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Message, Goal } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Send, Target, Eraser, AlertTriangle, Lightbulb, MessageSquare, Wand2, Sparkles, Award, Star, Rocket, BrainCircuit } from "lucide-react";
import ChatMessage from "@/components/chat-message";
import { ChatLoadingIndicator } from "@/components/chat-loading-indicator";
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

// Import the Message interface from chat-message.tsx which includes onRegenerateAnswer
interface MessageWithRegenerate extends Message {
  onRegenerateAnswer?: () => void;
}

// Using Message type as a base but with string id for optimistic updates
type OptimisticMessage = {
  id: string; // UUID for optimistic updates
  userId: number;
  content: string;
  isBot: boolean;
  timestamp: Date;
  chatId: number;
  createdAt: Date;
}

// Array of prompts that users can quickly select
interface Prompt {
  text: string;
  message?: string;
  description: string;
}

// Prompt categories to organize the prompts
interface PromptCategory {
  name: string;
  icon: JSX.Element;
  prompts: Prompt[];
}

const promptCategories: PromptCategory[] = [
  {
    name: "タスク管理 🎯",
    icon: <Target className="h-4 w-4" />,
    prompts: [
      {
        text: "タスク達成プラン✨",
        message: "私のタスクを達成するための具体的なアクションプランを教えてください。ステップごとに分解して、期日も含めて詳しく説明してください。",
        description: "タスク達成のための具体的なステップ計画を提案",
      },
      {
        text: "タスク設定アドバイス📝",
        message: "効果的なタスク設定のポイントについて教えてください。SMARTタスクとは何ですか？",
        description: "適切なタスク設定方法についてのアドバイス",
      },
      {
        text: "モチベーション維持法🚀",
        message: "タスク達成のためのモチベーションを維持する方法を教えてください。やる気が出ない時の対処法も含めて。",
        description: "モチベーション維持の戦略を提案",
      },
      {
        text: "タスク進捗確認📊",
        message: "タスクの進捗状況を効果的に確認・管理する方法について教えてください。",
        description: "進捗管理のベストプラクティス",
      },
      {
        text: "困難克服法💪",
        message: "タスク達成の過程で直面する困難や障害を克服するための方法を教えてください。",
        description: "障害を乗り越えるための戦略",
      },
      {
        text: "タスク見直し方法🔄",
        message: "タスクが現実的でないと感じた時、どのように見直すべきですか？タスクを調整する際のポイントを教えてください。",
        description: "タスクの再評価と調整方法",
      },
    ]
  },
  {
    name: "習慣形成 ⏱️",
    icon: <Rocket className="h-4 w-4" />,
    prompts: [
      {
        text: "習慣化の秘訣🔑",
        message: "タスク達成につながる良い習慣を形成するための効果的な方法を教えてください。",
        description: "持続可能な習慣を作るコツ",
      },
      {
        text: "朝のルーティン☀️",
        message: "生産性を高める朝のルーティンについてアドバイスください。タスク達成に役立つ朝の習慣は？",
        description: "タスク達成を促進する朝の習慣",
      },
      {
        text: "小さな成功の積み重ね📈",
        message: "小さな成功体験を積み重ねて大きなタスクを達成する方法について教えてください。",
        description: "小さな成功の活用法",
      },
      {
        text: "悪習慣の断ち切り方🚫",
        message: "タスク達成の妨げになる悪い習慣を断ち切るための効果的な方法を教えてください。",
        description: "悪習慣を克服する戦略",
      },
    ]
  },
  {
    name: "分析・振り返り 🔍",
    icon: <BrainCircuit className="h-4 w-4" />,
    prompts: [
      {
        text: "タスク進捗分析📊",
        message: "私のタスク達成状況を分析して、改善点を指摘してください。",
        description: "タスク進捗の分析と改善点提案",
      },
      {
        text: "週間振り返り🔄",
        message: "週間タスクの振り返りをサポートしてください。何を振り返るべきかも教えてください。",
        description: "効果的な週間振り返りのガイド",
      },
      {
        text: "次のステップ提案➡️",
        message: "現在のタスク達成状況を踏まえて、次に取るべきステップを提案してください。",
        description: "次のアクションの提案",
      },
      {
        text: "成功要因分析✨",
        message: "これまでの成功パターンを分析して、今後のタスク達成にどう活かせるか教えてください。",
        description: "成功パターンの分析と活用法",
      },
    ]
  },
];

// Component for selecting emotion/prompt buttons
interface EmotionButtonsProps {
  onSelect: (message: string) => void;
  onClose: () => void;
}

const EmotionButtons = ({ onSelect, onClose }: EmotionButtonsProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(promptCategories[0].name);

  // Handle clicks outside the emotion buttons to close it
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedCategoryData = promptCategories.find(cat => cat.name === selectedCategory) || promptCategories[0];

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
            <span className="text-xs text-muted-foreground mt-0.5">{prompt.description}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export function GoalChatInterface() {
  const [messageText, setMessageText] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [showEmotions, setShowEmotions] = useState(false);
  const isMobile = window.innerWidth < 640;
  const [chatInput, setChatInput] = useState("");

  // Fetch goal-specific messages
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['/api/goal-messages', 'messages'],
    enabled: !!user,
  });

  // Clear chat history mutation
  const clearChatHistoryMutation = useMutation({
    mutationFn: async () => {
      // Make DELETE request to the API endpoint
      await apiRequest('DELETE', '/api/goal-messages');
    },
    onSuccess: () => {
      // Clear optimistic messages
      setOptimisticMessages([]);

      // Clear the query cache
      queryClient.setQueryData(['/api/goal-messages'], []);

      // Invalidate the messages query to ensure it's updated
      queryClient.invalidateQueries({ queryKey: ['/api/goal-messages'] });

      toast({
        title: "会話履歴をクリアしました",
        description: "タスクアシスタントのチャット履歴が削除されました。",
      });
    },
    onError: (error) => {
      toast({
        title: "履歴クリアエラー",
        description: "チャット履歴を削除できませんでした。もう一度お試しください。",
        variant: "destructive",
      });
    },
  });

  // Send a message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', '/api/goal-chat', { content });
      return await response.json() as Message;
    },
    onMutate: async (content) => {
      // Add an optimistic message from the user
      const optimisticUserMessage: OptimisticMessage = {
        id: uuidv4(),
        userId: user?.id || 0,
        content,
        isBot: false,
        timestamp: new Date(),
        chatId: -1,
        createdAt: new Date(),
      };

      setOptimisticMessages(prev => [...prev, optimisticUserMessage]);
      return { optimisticUserMessage };
    },
    onSuccess: (newBotMessage: Message, content) => {
      // Create a user message based on our input
      const userMessage: Message = {
        id: newBotMessage.id - 1, // Assume user message is 1 ID before bot response
        userId: user?.id || 0,
        content: content,
        isBot: false,
        createdAt: new Date(new Date(newBotMessage.createdAt!).getTime() - 1000),
        chatId: newBotMessage.chatId,
      };

      // Remove our optimistic responses
      setOptimisticMessages([]);

      // Update the messages in the cache with both the user message and bot response
      queryClient.setQueryData<Message[]>(
        ['/api/goal-messages', 'messages'],                               // new query-key
        (oldMessages = []) => {
          // Avoid duplicate user messages (same content within 5 s)
          const userMessageExists = oldMessages.some(m =>
            !m.isBot &&
            m.content === content &&
            (() => {
              const t = m.createdAt;
              if (!t) return false;
              const ms = t instanceof Date ? t.getTime() : new Date(t).getTime();
              return Math.abs(ms - Date.now()) < 5000;
            })()
          );

          return userMessageExists
            ? [...oldMessages, newBotMessage]
            : [...oldMessages, userMessage, newBotMessage];
        }
      );
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      setOptimisticMessages([]);
      toast({
        title: "メッセージ送信エラー",
        description: "メッセージを送信できませんでした。もう一度お試しください。",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth',
          });
        }, 50); // short delay for new content layout
      }
    }
  }, [messages, optimisticMessages, sendMessage.isPending]);

  // Handle the insertion of prompt text
  const handleEmotionSelect = (text: string) => {
    const textarea = inputRef.current;
    if (!textarea) {
      setMessageText(prev => prev + text);
      return;
    }

    textarea.focus();

    const start = textarea.selectionStart ?? messageText.length;
    const end = textarea.selectionEnd ?? messageText.length;

    const newValue = messageText.slice(0, start) + text + messageText.slice(end);
    setMessageText(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;

      // Automatically adjust the textarea height
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }, 0);
  };




  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    sendMessage.mutate(messageText);
    setMessageText("");

    // Focus back on the input field after sending
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // All messages including optimistic ones
  const allMessages = [
    ...(messages || []),
    ...optimisticMessages
  ].sort((a, b) => {
    // Sort by timestamp
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  });

  return (
    <Card className="flex flex-col h-full bg-black text-noble-black-100 border border-noble-black-900  md:h-full">


      <CardHeader className="py-2 px-4 flex-shrink-0">
        <div className="flex flex-col space-y-1.5">
          <CardTitle className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Target className="h-5 w-5 text-blue-500" />
                <motion.div
                  className="absolute inset-0 rounded-full border border-blue-500/20"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0.2, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <span className="text-sm sm:text-base font-semibold">タスクアシスタント</span>
              <Badge variant="outline" className="ml-1 bg-noble-black-100  text-xs py-0">ミライAI</Badge>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 w-6 sm:h-7 sm:w-auto px-0 sm:px-2 rounded-full sm:rounded-md"
                onClick={() => setShowEmotions(true)}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline ml-1">ガイド</span>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 w-6 sm:h-7 sm:w-auto px-0 sm:px-2 rounded-full sm:rounded-md"
                    disabled={!allMessages.length}
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline ml-1">履歴削除</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="mx-auto max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl p-6">

                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      チャット履歴を削除しますか？
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      この操作は元に戻せません。すべての会話履歴がデータベースから完全に削除されます。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearChatHistoryMutation.mutate()}
                      className="bg-destructive hover:bg-destructive/90"
                      disabled={clearChatHistoryMutation.isPending}
                    >
                      {clearChatHistoryMutation.isPending ? "削除中..." : "削除する"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardTitle>

        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-grow min-h-0 bg-noble-black-900 border-x-2 p-0 border-black ">

        <ScrollArea ref={scrollAreaRef} className="flex-grow min-h-0 overflow-y-auto ">
          {isLoadingMessages ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <ChatLoadingIndicator message="チャット履歴を読み込んでいます..." />
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex flex-col h-full min-h-[200px] items-center justify-center text-center p-2 sm:p-4 bg-black ">
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-blue-500/30"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 0.2, 0.7],
                    borderColor: ["rgba(59, 130, 246, 0.3)", "rgba(59, 130, 246, 0.1)", "rgba(59, 130, 246, 0.3)"]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <img
                  src="/images/mirai.png"
                  alt="Chat Icon"
                  className="h-16 w-16 mb-6 relative z-10"
                />
              </div>

              <h3 className="text-xl font-medium mb-3 text-blue-500">ミライタスクアシスタントへようこそ</h3>
              <p className="max-w-md text-muted-foreground mb-6">
                タスクの設定から達成までをサポートします。何でもお気軽にご相談ください。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full mb-4">
                <Button
                  variant="outline"
                  className="text-left h-auto py-2 sm:py-3 justify-start border-noble-black-900 hover:bg-noble-black-100 bg-noble-black-900 text-noble-black-100"
                  onClick={() => handleEmotionSelect("タスク達成のためのベストなアクションプランを教えてください。")}
                >
                  <div className="flex items-start gap-2">
                    <Rocket className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm sm:text-base">タスク達成プラン</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">ステップごとの実行計画を提案</p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="text-left h-auto py-2 sm:py-3 justify-start border-noble-black-900 hover:bg-noble-black-100 bg-noble-black-900 text-noble-black-100"
                  onClick={() => handleEmotionSelect("タスク達成のモチベーションを維持する方法を教えてください。")}
                >
                  <div className="flex items-start gap-2">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm sm:text-base">モチベーション維持</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">継続するためのコツを紹介</p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="text-left h-auto py-2 sm:py-3 justify-start border-noble-black-900 hover:bg-noble-black-100 bg-noble-black-900 text-noble-black-100"
                  onClick={() => handleEmotionSelect("SMARTタスクの設定方法について教えてください。")}
                >
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm sm:text-base">効果的なタスク設定</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">達成しやすいタスクの立て方</p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="text-left h-auto py-2 sm:py-3 justify-start border-noble-black-900 hover:bg-noble-black-100 bg-noble-black-900 text-noble-black-100"
                  onClick={() => handleEmotionSelect("タスク達成を妨げる障害を克服する方法を教えてください。")}
                >
                  <div className="flex items-start gap-2">
                    <BrainCircuit className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm sm:text-base">障害の克服</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">問題解決のためのアドバイス</p>
                    </div>
                  </div>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                または、上のメニューから「ガイド」をクリックして、その他の質問例を見ることもできます
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4  min-h-[200px] p-4">
              {allMessages.map((message, idx) => {
                // Ensure id is treated as a number for the ChatMessage component
                const messageForChat = {
                  ...message,
                  // Convert string id to number for optimistic messages
                  id: typeof message.id === 'string' ? parseInt(message.id.replace(/\D/g, '')) || -1 : message.id,
                  onRegenerateAnswer: message.isBot
                    ? () => { /* Implement regenerate functionality if needed */ }
                    : undefined
                };
                return (
                  <ChatMessage
                    key={message.id}
                    message={messageForChat}
                    isFirstInGroup={idx === 0}
                    isLastInGroup={idx === allMessages.length - 1}
                    isPlayingAudio={false}
                    playingMessageId={null}
                    onPlayAudio={() => { }}
                  />
                );
              })}
              {sendMessage.isPending && (
                <div className="py-2">
                  <ChatLoadingIndicator variant="minimal" />
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <CardFooter className="p-2 sm:p-4 pt-2 flex-shrink-0 bg-black border-t border-noble-black-900 mt-auto rounded-2xl">
        <form onSubmit={handleSubmit} className="flex w-full gap-1 sm:gap-2 relative">
          <AnimatePresence>
            {showEmotions && (
              <div className="absolute bottom-full left-0 w-full flex justify-center">
                <EmotionButtons onSelect={handleEmotionSelect} onClose={() => setShowEmotions(false)} />
              </div>
            )}
          </AnimatePresence>

          <div className="relative w-full">
            <Textarea
              ref={inputRef}
              placeholder="タスクについて質問する..."
              value={messageText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageText(e.target.value)}
              disabled={sendMessage.isPending}
              className="w-full pr-8 min-h-[36px] sm:min-h-[40px] max-h-[100px] sm:max-h-[200px] resize-none text-sm sm:text-base bg-noble-black-900 text-noble-black-100 outline-none focus:outline-none active:outline-none border border-noble-black-900"
              rows={1}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                  e.preventDefault();
                  handleSubmit(e);
                }
                // Automatically adjust the textarea height
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    className="absolute right-2 top-1.5 text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent/50"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseDown={(e) => e.stopPropagation()}   // 🛠️ Add this
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

          <Button
            type="submit"
            size="icon"
            disabled={!messageText.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">送信</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}