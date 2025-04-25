import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import ChatInterface from "@/components/chat-interface";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Network, Cpu, Server, Database, Globe, LogOut, FileText, Book, Target, Trash2, FileOutput, MoreVertical } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChatPDFExport } from "@/components/chat-pdf-export";
import { Message } from "@shared/schema";
import { NotesList } from "@/components/notes-list";
import { EnhancedTaskTracker } from "@/components/enhanced-task-tracker";
import { GoalChatInterface } from "@/components/goal-chat-interface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [showParticles, setShowParticles] = useState(false);
  const [currentGreeting, setCurrentGreeting] = useState("");
  const [activeTab, setActiveTab] = useState<string>("chat");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { toast } = useToast();

  // Get messages for PDF export
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

  // Extract username before '@' from email
  const displayName = user?.username?.split("@")[0];

  // Futuristic Japanese greetings
  const greetings = [
    "システム接続完了",
    "インターフェース起動",
    "プロトコル確認",
    "データリンク確立",
    "セッション開始",
    "ようこそオペレーター"
  ];

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    let greeting = "";

    if (hour >= 5 && hour < 12) {
      greeting = greetings[0]; // Morning protocol
    } else if (hour >= 12 && hour < 17) {
      greeting = greetings[1]; // Afternoon interface
    } else {
      greeting = greetings[2]; // Evening session
    }

    // Add a random additional greeting sometimes
    if (Math.random() > 0.7) {
      const randomIndex = Math.floor(Math.random() * (greetings.length - 3)) + 3;
      greeting += " // " + greetings[randomIndex];
    }

    setCurrentGreeting(greeting);
  }, []);

  // Floating tech particles animation trigger
  useEffect(() => {
    // Show particle animation on initial load
    setShowParticles(true);
    const timer = setTimeout(() => setShowParticles(false), 5000);

    // Show particles again every so often
    const interval = setInterval(() => {
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 5000);
    }, 25000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Tech particles animation
  const TechParticlesAnimation = () => (
    <AnimatePresence>
      {showParticles && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
          {Array.from({ length: 20 }).map((_, index) => (
            <motion.div
              key={index}
              className="absolute text-lg"
              initial={{ 
                top: `-5%`,
                left: `${Math.random() * 100}%`,
                rotate: 0,
                opacity: 0
              }}
              animate={{ 
                top: `${Math.random() * 110 + 10}%`,
                left: `${Math.random() * 100}%`,
                rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
                opacity: [0, 1, 0.8, 0]
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 5 + Math.random() * 7,
                ease: "easeInOut"
              }}
            >
              {Math.random() > 0.5 ? 
                <Zap size={18} className="text-blue-400" /> : 
                <Network size={18} className="text-blue-500" />
              }
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );

  // Render main content based on active tab
  const renderMainContent = () => {
    if (activeTab === "chat") {
      return (
            <motion.div 
              className="bg-slate-900/90 backdrop-blur-md rounded-none sm:rounded-xl shadow-xl py-4 sm:py-0 px-0 w-full max-w-full border-0 sm:border border-blue-500/20 overflow-hidden relative h-[calc(100vh-3.5rem)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >

          <div className="relative z-10 h-full flex">
            <ChatInterface />
          </div>
        </motion.div>

      );
    } else if (activeTab === "notes") {
      return (
        <motion.div 
          className="bg-slate-900/90 backdrop-blur-md rounded-xl shadow-xl p-4 max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto border border-blue-500/20 overflow-hidden relative h-[calc(100vh-8rem)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {/* Circuit-like pattern background */}
          <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-1/2 h-px bg-blue-400" />
            <div className="absolute top-1/2 left-1/6 w-2/3 h-px bg-blue-400" />
            <div className="absolute top-3/4 left-1/3 w-1/3 h-px bg-blue-400" />
            <div className="absolute top-1/6 left-1/2 w-px h-2/3 bg-blue-400" />
            <div className="absolute top-1/4 left-2/3 w-px h-1/2 bg-blue-400" />
            <div className="absolute top-1/3 left-1/3 w-px h-1/3 bg-blue-400" />
          </div>

          {/* Tech corner elements */}
          <div className="absolute top-2 left-2 text-blue-400 opacity-30">
            <Book size={14} />
          </div>
          <div className="absolute top-2 right-2 text-blue-500 opacity-30">
            <FileText size={14} />
          </div>
          <div className="absolute bottom-2 left-2 text-blue-400 opacity-30">
            <Database size={14} />
          </div>
          <div className="absolute bottom-2 right-2 text-blue-500 opacity-30">
            <Cpu size={14} />
          </div>

          <div className="relative z-10 h-full">
            <NotesList />
          </div>
        </motion.div>
      );
    } else if (activeTab === "goals") {
      return (
        <motion.div 
          className="bg-slate-900/90 backdrop-blur-md rounded-xl shadow-xl p-4 max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto border border-blue-500/20 overflow-hidden relative h-[calc(100vh-5rem)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
         

         

          <div className="relative z-10 h-full">
            <div className="h-full flex flex-col md:flex-row gap-4">
              {/* Mobile tabs to switch between goal tracker and chat */}
              <div className="flex md:hidden mb-2">
                <Tabs defaultValue="tracker" className="w-full">
                  <TabsList className="bg-slate-800/50 border border-blue-500/20 w-full sticky top-0 z-10">
                    <TabsTrigger value="tracker" className="flex-1 gap-1.5">
                      <Target className="h-3.5 w-3.5" />
                      <span>タスク</span>
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="flex-1 gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      <span>アシスタント</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tracker" className="mt-2 h-[calc(100vh-10.5rem)] overflow-y-auto">
                    <EnhancedTaskTracker />
                  </TabsContent>

                  <TabsContent value="chat" className="mt-2 h-[calc(100vh-9.5rem)] overflow-hidden">
                    <div className="h-full flex flex-col">
                      <div className="flex-grow flex">
                        <GoalChatInterface />
                      </div>
                    </div>
                  </TabsContent>


                </Tabs>
              </div>

              {/* Desktop layout with side-by-side view */}
              <div className="hidden md:flex md:flex-row w-full h-full gap-4">
                <div className="md:w-1/3 h-full flex">
                  <div className="flex-grow flex">
                    <EnhancedTaskTracker />
                  </div>
                </div>
                <div className="md:w-2/3 h-full border-l border-blue-500/20 pl-4">
                  <GoalChatInterface />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
      {/* Floating decorative elements */}
      <div className="absolute top-20 right-10 opacity-20 hidden md:block">
        <motion.div
          animate={{ 
            y: [0, -10, 0],
            rotate: 360
          }}
          transition={{ 
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 20, repeat: Infinity, ease: "linear" }
          }}
        >
          <Database className="h-16 w-16 text-blue-300" />
        </motion.div>
      </div>

      <div className="absolute bottom-20 left-10 opacity-10 hidden md:block">
        <motion.div
          animate={{ 
            y: [0, 10, 0],
            rotate: -360
          }}
          transition={{ 
            y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 25, repeat: Infinity, ease: "linear" }
          }}
        >
          <Globe className="h-20 w-20 text-blue-400" />
        </motion.div>
      </div>

      {/* Tech particles animation */}
      <TechParticlesAnimation />

      {/* Redesigned elegant header */}
      <header className="border-b border-blue-900/50 bg-slate-950/80 backdrop-blur-md shadow-md fixed top-0 left-0 right-0 z-50 w-full">
        <div className="w-full max-w-full px-2 sm:px-4 py-1 sm:py-1.5">
          <div className="flex justify-between items-center">
            {/* Left: Company Logo + AI Brand */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Company Logo */}
              <motion.div
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-700 to-slate-800 border border-blue-500/20 shadow-lg"
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 0 15px rgba(59, 130, 246, 0.5)",
                  borderColor: "rgba(59, 130, 246, 0.4)"
                }}
              >
                <img
                  src="/images/mirai.png"
                  alt="Company Logo"
                  className="h-full w-full object-contain"
                />
              </motion.div>

              {/* AI Brand Logo integrated */}
              <motion.div
                className="relative flex items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="font-mono text-lg sm:text-xl text-blue-400 font-bold flex items-center gap-1"
                  animate={{ 
                    textShadow: [
                      "0 0 3px rgba(59, 130, 246, 0.5)",
                      "0 0 7px rgba(59, 130, 246, 0.8)",
                      "0 0 3px rgba(59, 130, 246, 0.5)"
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >

                  <span>ミライ</span>
                </motion.div>

                {/* Decorative rotating rings */}
                <motion.div
                  className="absolute inset-0 -z-10 rounded-full border border-blue-500/30 border-t-blue-500/80"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>
            </div>

            {/* Center: View Tabs */}
            <div className="hidden md:flex justify-center items-center">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-slate-800/50 border border-blue-500/20">
                  <TabsTrigger 
                    value="chat" 
                    className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 gap-1.5"
                  >
                    <Server className="h-3.5 w-3.5" />
                    <span>ホーム</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="notes" 
                    className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 gap-1.5"
                  >
                    <Book className="h-3.5 w-3.5" />
                    <span>ノート</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="goals" 
                    className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 gap-1.5"
                  >
                    <Target className="h-3.5 w-3.5" />
                    <span>タスク</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Right: User Info & Actions */}
            <div className="flex items-center gap-2">
              {/* Mobile Tabs */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Cycle through tabs: chat -> notes -> goals -> chat
                    if (activeTab === "chat") setActiveTab("notes");
                    else if (activeTab === "notes") setActiveTab("goals");
                    else setActiveTab("chat");
                  }}
                  className="text-blue-300 hover:bg-blue-900/20 flex items-center gap-1.5"
                >
                  {activeTab === "chat" ? (
                    <>
                      <Book className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:text-xs">ノート</span>
                    </>
                  ) : activeTab === "notes" ? (
                    <>
                      <Target className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:text-xs">タスク</span>
                    </>
                  ) : (
                    <>
                      <Server className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:text-xs">ホーム</span>
                    </>
                  )}
                </Button>
              </div>
              
             


              {/* Username badge - consistent on all devices */}
              <AnimatePresence>
                {displayName && (
                  activeTab === "chat" ? (
                    // Show dropdown only in "chat" tab
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <motion.div 
                          className="flex items-center gap-1 bg-slate-800/70 px-2 py-1 rounded-md border border-blue-500/20 backdrop-blur-sm cursor-pointer"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.3 }}
                        >
                          <motion.span 
                            className="text-xs sm:text-sm font-medium text-blue-300 font-mono"
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <span className="sm:hidden">{displayName.charAt(0).toUpperCase()}</span>
                            <span className="hidden sm:inline">{displayName}</span>
                          </motion.span>
                          <Zap className="h-3 w-3 text-blue-400" />
                        </motion.div>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="bg-slate-900 border border-blue-500/30">
                        
                        <DropdownMenuSeparator className="bg-blue-900/30" />

                        {messages.length > 0 && (
                          <DropdownMenuItem 
                            className="text-blue-300 hover:bg-blue-800/30 cursor-pointer flex items-center gap-2"
                            onClick={handleClearChat}
                          >
                            <Trash2 className="h-4 w-4 text-blue-400" />
                            <span>チャット履歴をクリア</span>
                          </DropdownMenuItem>
                        )}

                        {messages.length > 0 && (
                          <DropdownMenuItem 
                            onSelect={(e) => e.preventDefault()}
                            className="p-0 focus:bg-transparent hover:bg-transparent"
                          >
                            <div className="w-full h-full px-2 py-1.5 flex items-center gap-2">
                              <div onClick={(e) => e.stopPropagation()} className="ml-auto">
                                <ChatPDFExport messages={messages} />
                              </div>
                            </div>
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator className="bg-blue-900/30" />
                        <DropdownMenuItem 
                          className="text-blue-300 hover:bg-blue-800/30 cursor-pointer flex items-center gap-2"
                          onClick={() => logoutMutation.mutate()}
                          disabled={logoutMutation.isPending}
                        >
                          <LogOut className="h-4 w-4 text-blue-400" />
                          <span>ログアウト</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    // Show static badge in all other tabs
                    <motion.div 
                      className="flex items-center gap-1 bg-slate-800/70 px-2 py-1 rounded-md border border-blue-500/20 backdrop-blur-sm"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.span 
                        className="text-xs sm:text-sm font-medium text-blue-300 font-mono"
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <span className="sm:hidden">{displayName.charAt(0).toUpperCase()}</span>
                        <span className="hidden sm:inline">{displayName}</span>
                      </motion.span>
                      <Zap className="h-3 w-3 text-blue-400" />
                    </motion.div>
                  )
                )}
              </AnimatePresence>


              {/* Logout button */}
              {(activeTab !== "chat" || window.innerWidth >= 768) && (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    className="text-blue-300 hover:bg-blue-900/20 h-8 w-8 sm:h-9 sm:w-9"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}

            </div>
          </div>
        </div>
      </header>

      {/* Greeting message */}
        {activeTab !== "chat" && activeTab !== "goals" &&  (
        <motion.div 
          className="container mx-auto px-4 py-2 text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.h2 
            className="text-lg text-blue-400 font-mono tracking-wider"
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
          >
            <span className="text-blue-300">[</span>
            {displayName && `${displayName}`}
            <span className="text-blue-300">]</span>
            <span className="mx-2 animate-pulse">»</span>
            {currentGreeting}
          </motion.h2>
        </motion.div>
      )}


      {/* Main content section */}
      <main className="flex-1 w-full max-w-full px-0 pt-14 sm:pt-16">
        {renderMainContent()}
      </main>

      {/* Confirmation Dialog for clearing chat history */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="bg-slate-900 border border-blue-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-blue-100">チャット履歴をクリアしますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300/70">
              この操作は取り消せません。すべてのチャット履歴が削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-blue-200 border-slate-700 hover:bg-slate-700">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearChatHistory.mutate()}
              className="bg-red-900/50 hover:bg-red-900 text-red-50 border border-red-800"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeTab !== "chat" && (
        <footer className="border-t border-blue-900/30 py-2 bg-slate-950/60 backdrop-blur-md">
          <div className="container mx-auto px-4 text-center">
            <motion.p 
              className="text-xs text-blue-400/80 font-mono"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="text-blue-500">⦿</span> ミライ – FSDのAIアシスタント <span className="text-blue-500">⦿</span>
            </motion.p>
          </div>
        </footer>
      )}


    </div>
  );
}