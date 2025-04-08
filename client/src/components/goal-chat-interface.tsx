import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Message } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, Target, Eraser, AlertTriangle, Lightbulb, MessageSquare, Wand2 } from "lucide-react";
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
  sessionId: string;
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

export function GoalChatInterface() {
  const [messageText, setMessageText] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [showEmotions, setShowEmotions] = useState(false);
  const isMobile = window.innerWidth < 640;
  const [chatInput, setChatInput] = useState("");

  // Fetch goal-specific messages
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['/api/goal-messages'],
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
        description: "目標アシスタントのチャット履歴が削除されました。",
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
        sessionId: "optimistic",
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
        timestamp: new Date(new Date(newBotMessage.timestamp).getTime() - 1000), // 1 second before bot response
        sessionId: newBotMessage.sessionId,
      };
      
      // Remove our optimistic responses
      setOptimisticMessages([]);
      
      // Update the messages in the cache with both the user message and bot response
      queryClient.setQueryData<Message[]>(['/api/goal-messages'], (oldMessages = []) => {
        // Check if the user message already exists to avoid duplicates
        const userMessageExists = oldMessages.some(m => 
          !m.isBot && m.content === content && 
          // Check if timestamps are close (within 5 seconds)
          Math.abs(new Date(m.timestamp).getTime() - new Date().getTime()) < 5000
        );
        
        if (userMessageExists) {
          return [...oldMessages, newBotMessage];
        } else {
          return [...oldMessages, userMessage, newBotMessage];
        }
      });
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
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
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
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  return (
    <Card className="flex flex-col h-full w-full">
      <CardHeader className="pb-2">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    <span className="text-lg sm:text-xl md:text-2xl font-semibold">目標アシスタント</span>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs flex items-center gap-1 self-end sm:self-auto"
                        disabled={!allMessages.length}
                      >
                <Eraser className="h-3.5 w-3.5" />
                履歴削除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
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
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea ref={scrollAreaRef} className="min-h-[300px] h-[calc(100vh-13rem)] px-4 pt-4">
          {isLoadingMessages ? (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <ChatLoadingIndicator message="チャット履歴を読み込んでいます..." />
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex flex-col h-full min-h-[300px] items-center justify-center text-center text-muted-foreground p-4">
              <img
                src="/images/mirai.png"
                alt="Chat Icon"
                className="h-20 w-20 mb-4 opacity-80"
              />
              <h3 className="text-lg font-medium">目標アシスタントへようこそ</h3>
              <p className="max-w-sm">
                目標の設定や進捗確認について質問してください。
                いつでもあなたの目標達成をサポートします。
              </p>
            </div>
          ) : (
            <div className="space-y-4 pb-4 min-h-[300px]">
              {allMessages.map((message) => {
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
      
      <CardFooter className="p-4 pt-2">
        <form onSubmit={handleSubmit} className="flex w-full gap-2 relative">
          <AnimatePresence>
            {showEmotions && (
              <div className="absolute bottom-full left-0 w-full flex justify-center">
                <EmotionButtons onSelect={handleEmotionSelect} onClose={() => setShowEmotions(false)} />
              </div>
            )}
          </AnimatePresence>
          
          <div className="relative w-full">
            <Input
              ref={inputRef}
              placeholder="目標についてミライちゃんに質問する..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={sendMessage.isPending}
              className="w-full pr-8"
              autoComplete="off"
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