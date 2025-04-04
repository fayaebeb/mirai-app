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
import { Send, Bot, Target } from "lucide-react";
import ChatMessage from "@/components/chat-message";
import { ChatLoadingIndicator } from "@/components/chat-loading-indicator";
import { v4 as uuidv4 } from 'uuid';

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

export function GoalChatInterface() {
  const [messageText, setMessageText] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);

  // Fetch goal-specific messages
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['/api/goal-messages'],
    enabled: !!user,
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
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          <span>目標アシスタント</span>
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
              <Bot className="h-12 w-12 mb-4 text-primary/30" />
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
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            ref={inputRef}
            placeholder="目標についてミライちゃんに質問する..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            disabled={sendMessage.isPending}
            className="flex-grow"
            autoComplete="off"
          />
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