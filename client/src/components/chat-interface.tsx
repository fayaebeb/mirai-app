import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, Check, Sparkles, Heart, Lightbulb, Wand2, MessageSquare, FileText, Trash2 } from "lucide-react";
import { Message } from "@shared/schema";
import { nanoid } from "nanoid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ChatMessage from "./chat-message";
import { ScrollArea } from "./ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ChatLoadingIndicator, { SakuraPetalLoading } from "./chat-loading-indicator";
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
} from "@/components/ui/alert-dialog";
import { ChatPDFExport } from "./chat-pdf-export";

// Define a type for optimistic messages that uses string IDs instead of numbers
type OptimisticMessage = {
  id: string; 
  userId: number;
  content: string;
  isBot: boolean;
  timestamp: Date;
  sessionId: string;
}

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
      description: "「ミライ」は、PCKKにおいて、情報提供や質問への回答を行うAIです。私の役割は、さまざまなトピックについて正確で分かりやすい情報を提供し、ユーザーのリクエストに的確にお応えすることです。たとえば、データに基づくご質問には、社内資料や外部情報を参照しながら丁寧にお答えします。",
      icon: <Sparkles className="h-5 w-5 text-pink-400" />
    },
    {
      title: "楽しくお話ししましょう！",
      description: "「ミライ」は、OpenAIの生成モデル「GPT-4o」を使用しています。社内の全国うごき統計に関する営業資料や、人流に関する社内ミニ講座の内容を基礎データとして取り込み、さらにWikipediaやGoogleのAPIを通じてインターネット上の情報も収集しています。これらの情報をもとに、最適な回答を生成しています。",
      icon: <Heart className="h-5 w-5 text-red-400" />
    },
  ];

  return (
    <motion.div
      className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
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
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
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
              <Button
                size="sm"
                onClick={() => setStep(step + 1)}
              >
                次へ
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onClose}
              >
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

// Prompt categories to organize the prompts
interface PromptCategory {
  name: string;
  icon: JSX.Element;
  prompts: Prompt[];
}

const promptCategories: PromptCategory[] = [
  {
    name: "出力形式 📄",
    icon: <MessageSquare className="h-4 w-4" />,
    prompts: [
      {
            text: "会話形式で💬",
            message: "AさんとBさんの会話形式で出力して",
            description: "フレンドリーな会話形式で回答します",
          },
          {
            text: "箇条書き形式で📝",
            message: "箇条書き形式で出力して",
            description: "箇条書き形式で出力します",
          },
          {
            text: "表形式で📊",
            message: "表形式で出力して",
            description: "表形式で出力します",
          },
          {
            text: "FAQ形式で❓",
            message: "FAQ形式で出力して",
            description: "FAQ形式で出力します",
          },
          {
            text: "比喩・たとえ話形式🎭",
            message: "比喩・たとえ話形式で出力して",
            description: "比喩・たとえ話形式で出力します",
          },
          {
            text: "簡潔に要約✨",
            message: "簡潔に要約で出力して",
            description: "簡潔に要約で出力します",
      },
    ]
  },
  {
    name: "アシスタント 🤖",
    icon: <Wand2 className="h-4 w-4" />,
    prompts: [
      {
        text: "＋指示のコツ🎯",
        message: "質問に対してさらに理解を深めるために、どのような指示をすればよいか提案して",
        description: "より良い指示の出し方をアドバイスします",
      },
      {
        text: "「外部情報なし」🚫",
        message: "インターネットからの情報を利用しないで",
        description: "外部情報を使わずに回答します",
      },
      {
        text: "初心者向け📘",
        message: "説明に出てくる専門用語には、それぞれ説明を加え、初心者でも理解しやすいように。具体的な例を挙げながら丁寧に解説して",
        description: "具体的な例を挙げながら丁寧に解説します",
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

export const ChatInterface = () => {
  const [input, setInput] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showEmotions, setShowEmotions] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = window.innerWidth < 640;

  // Check if online periodically
  useEffect(() => {
    const checkOnline = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', checkOnline);
    window.addEventListener('offline', checkOnline);

    // Set initial status
    checkOnline();

    return () => {
      window.removeEventListener('online', checkOnline);
      window.removeEventListener('offline', checkOnline);
    };
  }, []);

  // Show tutorial on first visit
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenChatTutorial');
    if (!hasSeenTutorial && user) {
      setShowTutorial(false); // Disable tutorial for now
      localStorage.setItem('hasSeenChatTutorial', 'true');
    }
  }, [user]);

  // Fetch previous messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/messages'],
    enabled: !!user,
  });

  // Clear chat history mutation
  const clearChatHistory = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'DELETE',
        '/api/messages'
      );
      return response.json();
    },
    onSuccess: () => {
      // Clear the messages in the query cache
      queryClient.setQueryData<Message[]>(['/api/messages'], []);
      
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
          messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    },
    onError: (error) => {
      console.error("Error clearing chat history:", error);
      toast({
        title: "エラーが発生しました",
        description: "チャット履歴のクリアに失敗しました。",
        variant: "destructive"
      });
    }
  });

  // Handle clear chat button click
  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messageEndRef]);

  // Send message mutation
  // Helper function to check if a message is goal-related
  const isGoalRelated = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    return lowerContent.includes('goal') || 
           lowerContent.includes('objective') ||
           lowerContent.includes('target') ||
           lowerContent.includes('achievement') ||
           lowerContent.includes('my goals');
  };

  const sendMessage = useMutation<Message, Error, string>({
    mutationFn: async (content: string) => {
      // Optimistic update for user message
      const optimisticUserMessage: OptimisticMessage = {
        id: nanoid(), // Using string ID for optimistic updates
        userId: user?.id || 0,
        content,
        isBot: false,
        sessionId: 'current',
        timestamp: new Date(),
      };

      // Update cache with user message
      queryClient.setQueryData<Message[]>(['/api/messages'], (old: Message[] = []) => {
        return [...old, optimisticUserMessage as any as Message];
      });

      // Detect if this is a goal-related message (handled on the server)
      console.log("Message being sent:", content);
      console.log("Is goal-related:", isGoalRelated(content));

      // Send to API and get the response
      const response = await apiRequest(
        'POST',
        '/api/messages',
        { content }
      );

      // Parse the response JSON to get the bot message
      const botMessage = await response.json();
      console.log("Received bot response:", botMessage);

      return botMessage;
    },
    onSuccess: (newBotMessage: Message) => {
      console.log("Successfully added bot message to chat:", newBotMessage);

      // Update cache with bot response
      queryClient.setQueryData<Message[]>(['/api/messages'], (old: Message[] = []) => {
        // Make sure we're not getting duplicates
        const messageExists = old.some(msg => 
          typeof msg.id === 'number' && 
          typeof newBotMessage.id === 'number' && 
          msg.id === newBotMessage.id
        );

        if (!messageExists) {
          return [...old, newBotMessage];
        }
        return old;
      });

      // Clear input field
      setInput('');

      // Force a refresh of the messages query
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Updated function to insert prompt text at the current cursor position
  const handleEmotionSelect = (text: string) => {
    const textarea = inputRef.current;
    if (!textarea) {
      setInput(prev => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = input.slice(0, start) + text + input.slice(end);
    setInput(newValue);
    // reposition the cursor after the inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || sendMessage.isPending) return;

    sendMessage.mutate(input);
  };

  return (
    <Card className="w-full h-[calc(100vh-14rem)] sm:h-[calc(100vh-12rem)] flex flex-col overflow-hidden relative border-muted-foreground/20">
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      {/* Confirmation Dialog for clearing chat history */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>チャット履歴をクリアしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。すべてのチャットメッセージがデータベースから削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => clearChatHistory.mutate()}
              className="bg-red-500 hover:bg-red-600"
            >
              クリア
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fixed Chat Header */}
      <div className="flex-shrink-0 border-b p-2 flex justify-between items-center bg-muted/30 sticky top-0 left-0 right-0 z-20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-medium">AI チャット会話</h2>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={handleClearChat}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>チャット履歴をクリア</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <ChatPDFExport messages={messages} />
        </div>
      </div>

      {/* Scrollable Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-1 sm:px-4 py-3 w-full" ref={scrollAreaRef}>
          <div className="space-y-4 w-full max-w-full">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Sparkles className="h-10 w-10 text-pink-300 mb-3" />
                  <h3 className="text-lg font-medium mb-2">対話を始めましょう</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto text-sm sm:text-base">
                    下のテキストボックスにメッセージを入力して、ミライと対話を開始してください
                  </p>
                </motion.div>
              </div>
            ) : (
              messages.map((message: Message) => {
                const lastUserMessageIndex = message.isBot
                  ? messages.findIndex((m: Message) => m.id === message.id) - 1
                  : -1;
                const lastUserMessage = lastUserMessageIndex >= 0 ? messages[lastUserMessageIndex] : null;

                const handleRegenerateAnswer = () => {
                  if (lastUserMessage?.content) {
                    sendMessage.mutate(lastUserMessage.content);
                  }
                };

                return (
                  <div className="w-full max-w-full" key={typeof message.id === 'string' ? message.id : `msg-${message.id}`}>
                    <ChatMessage
                      message={{
                        ...message,
                        onRegenerateAnswer: message.isBot ? handleRegenerateAnswer : undefined,
                      }}
                    />
                  </div>
                );
              })
            )}

            {sendMessage.isPending && (
              <div className="flex justify-center pt-2 pb-4">
                <ChatLoadingIndicator variant="character" message="ミライちゃんが処理中..." />
              </div>
            )}
            <div ref={messageEndRef} />
            {/* Add some bottom padding to ensure content isn't hidden behind the input area on small screens */}
            <div className="h-4" /> 
          </div>
        </ScrollArea>
      </div>

      {/* Message Input Form - Fixed at bottom */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 p-2 sm:p-3 border-t flex flex-col gap-1.5 bg-background sticky bottom-0 left-0 right-0 z-10">
        <AnimatePresence>
          {showEmotions && (
            <div className="absolute bottom-full left-0 w-full flex justify-center">
              <EmotionButtons onSelect={handleEmotionSelect} onClose={() => setShowEmotions(false)} />
            </div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              placeholder="メッセージを入力してください..."
              className="pr-10 focus:ring-2 focus:ring-pink-100 text-sm sm:text-base min-h-[38px] max-h-[200px] resize-none py-2"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <TooltipProvider key="prompt-tooltip">
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
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

          <motion.button
            type="submit"
            disabled={sendMessage.isPending}
            className="px-3 sm:px-4 py-2 h-[40px] rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 text-white shadow-[0_0_10px_rgba(255,255,255,0.3)] flex items-center gap-1 disabled:opacity-70 flex-shrink-0 hover:shadow-[0_0_20px_rgba(255,255,255,0.6)] transition-shadow"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Send className="h-4 w-4" />
            <span className="text-xs hidden sm:inline">送信する</span>
            <motion.span
              className="absolute -top-1 -right-1 text-xs"
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              ⚡
            </motion.span>
          </motion.button>
        </div>
      </form>
    </Card>
  );
};

export default ChatInterface;
