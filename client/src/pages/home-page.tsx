import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import ChatInterface from "@/components/chat-interface";
import { ChatInput } from "@/components/chat-input";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Network, Cpu, Server, Database, Globe, LogOut, FileText, Book, Target, Trash2, FileOutput, MoreVertical, MessageSquare, Wand2, BrainCircuit, Menu, Home, X, Download } from "lucide-react";
import { MindMapGenerator } from "@/components/mind-map-generator";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChatPDFExport } from "@/components/chat-pdf-export";
import { Message } from "@shared/schema";
import { NotesList } from "@/components/notes-list";
import { EnhancedTaskTracker } from "@/components/enhanced-task-tracker";
import { GoalChatInterface } from "@/components/goal-chat-interface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { nanoid } from "nanoid";
import Footer from "@/components/Footer";
import { useRecoilState } from "recoil";
import { ActiveTab, activeTabState } from "@/states/activeTabState";
import Navbar from "@/components/Navbar";
import TranscriptionConfirmation from "@/components/transcription-confirmation";
import { currentAudioUrlAtom, isPlayingAudioAtom, isProcessingVoiceAtom, playingMessageIdAtom } from "@/states/voicePlayerStates";

// Audio player for bot responses
const AudioPlayer = ({ audioUrl, isPlaying, onPlayComplete }: { audioUrl: string, isPlaying: boolean, onPlayComplete: () => void }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      } else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [isPlaying]);

  return (
    <audio
      ref={audioRef}
      src={audioUrl}
      onEnded={onPlayComplete}
      className="hidden"
    />
  );
};





export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [showParticles, setShowParticles] = useState(false);

  const [activeTab, setActiveTab] = useRecoilState(activeTabState);
  const [showMindMap, setShowMindMap] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  const [useWeb, setUseWeb] = useState(false);
  const [useDb, setUseDb] = useState(true);
  const [sessionId, setSessionId] = useState<string>("");
  const [showTranscriptionConfirmation, setShowTranscriptionConfirmation] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useRecoilState(currentAudioUrlAtom);
  const [playingMessageId, setPlayingMessageId] = useRecoilState(playingMessageIdAtom);
  const [isProcessingVoice, setIsProcessingVoice] = useRecoilState(isProcessingVoiceAtom);
  const [isPlayingAudio, setIsPlayingAudio] = useRecoilState(isPlayingAudioAtom);




  const CHAT_SESSION_KEY_PREFIX = "chat_session_id_user_";

  // Get messages for PDF export


  // Send message mutation with optimistic updates
  const sendMessage = useMutation<
    Message,
    Error,
    { content: string; useWeb: boolean; useDb: boolean },
    { previousMessages?: Message[] }
  >({
    mutationFn: async ({ content, useWeb, useDb }: { content: string; useWeb: boolean; useDb: boolean }) => {

      if (!sessionId) {
        throw new Error("セッションIDが見つかりません。再ログインしてください。");
      }

      const response = await apiRequest('POST', '/api/messages', {
        content,
        useWeb,
        useDb,
        isBot: false,
        sessionId
      });
      return response.json();
    },
    onMutate: async ({ content }: { content: string; useWeb: boolean; useDb: boolean }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/messages'] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<Message[]>(['/api/messages']);

      // Optimistically add user message
      const tempUserMessage: Message = {
        id: -Date.now(), // Temporary ID
        userId: user!.id,
        content,
        isBot: false,
        sessionId: `user_${user!.id}_${user!.email}`,
        timestamp: new Date(),
      };

      queryClient.setQueryData<Message[]>(['/api/messages'], (old = []) => [
        ...old,
        tempUserMessage
      ]);

      // Return a context object with the snapshotted value
      return { previousMessages };
    },
    onSuccess: (newBotMessage: Message) => {
      // Clear input field
      setInput('');

      // Add the bot message to the existing messages without invalidating
      queryClient.setQueryData<Message[]>(['/api/messages'], (old = []) => [
        ...old,
        newBotMessage
      ]);
    },
    onError: (error, content, context) => {
      console.error("Error sending message:", error);

      // Rollback to the previous state if there was an error
      if (context?.previousMessages) {
        queryClient.setQueryData(['/api/messages'], context.previousMessages);
      }

      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    }
  });

  const handleVoiceRecording = async (audioBlob: Blob) => {
    setIsProcessingVoice(true);

    try {
      // Show a toast to indicate processing
      toast({
        title: "音声認識中...",
        description: "あなたの声を認識しています。少々お待ちください。",
        duration: 2500,
      });

      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error("音声データが空です。もう一度録音してください。");
      }

      // Check audio blob type 
      if (!audioBlob.type.includes('audio') && !audioBlob.type.includes('webm')) {
        console.warn(`Unexpected audio blob type: ${audioBlob.type}, size: ${audioBlob.size}`);
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`Transcription failed with status ${res.status}: ${errorText}`);
      }

      const data = await res.json().catch(() => {
        throw new Error("Invalid JSON response from transcription service");
      });

      if (!data || !data.transcribedText) {
        throw new Error("音声認識結果が取得できませんでした。");
      }

      // Show confirmation with the transcribed text
      setTranscribedText(data.transcribedText);
      setShowTranscriptionConfirmation(true);

      toast({
        title: "音声認識成功",
        description: "内容を確認してから送信してください",
        duration: 3000,
      });
    } catch (error) {
      console.error("Voice transcription error:", error);
      toast({
        title: "音声処理エラー",
        description: error instanceof Error
          ? `認識できませんでした: ${error.message}`
          : "認識できませんでした。もう一度試してね！",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Handle confirming the transcribed text
  const handleConfirmTranscription = (confirmedText: string) => {
    setTranscribedText(null);
    setShowTranscriptionConfirmation(false);

    if (confirmedText.trim()) {
      sendMessage.mutate({
        content: confirmedText,
        useWeb: useWeb,
        useDb: useDb,
      });
    }
  };

  // Handle editing the transcribed text
  const handleEditTranscription = (editedText: string) => {
    setTranscribedText(editedText);
  };

  // Handle canceling the transcription
  const handleCancelTranscription = () => {
    setTranscribedText(null);
    setShowTranscriptionConfirmation(false);
  };


  // Handle audio playback completion
  const handlePlaybackComplete = () => {
    setIsPlayingAudio(false);
    setPlayingMessageId(null);
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl(null);
    }
  };


  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || sendMessage.isPending) return;

    // Clear immediately
    setInput("");

    sendMessage.mutate({ content: input, useWeb, useDb });
  };


  // Handle emotion selection from dropdown
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

  // Clear chat history mutation


  // Handle clear chat button click
  const handleClearChat = () => {
    setShowClearConfirm(true);
  };


  useEffect(() => {
    if (!user?.id) return;

    const storageKey = `${CHAT_SESSION_KEY_PREFIX}${user.id}`;
    let savedSessionId = localStorage.getItem(storageKey);

    // Validate saved session ID
    if (!savedSessionId || savedSessionId.trim() === "") {
      console.log("Creating new session ID - no previous ID found");
      savedSessionId = nanoid();
      localStorage.setItem(storageKey, savedSessionId);
    }

    console.log(`Using session ID: ${savedSessionId}`);
    setSessionId(savedSessionId);

    const persistentSessionId = user.email.split('@')[0];

    if (savedSessionId !== persistentSessionId) {
      console.log(
        `Note: localStorage session ID (${savedSessionId}) differs from persistent ID (${persistentSessionId})`
      );
    }

    // Setup periodic check for session integrity
    const interval = setInterval(() => {
      const currentStoredId = localStorage.getItem(storageKey);
      if (currentStoredId !== savedSessionId) {
        console.log("Session ID changed in another tab, updating");
        setSessionId(currentStoredId || savedSessionId);
        // Restore the session ID if it was accidentally cleared
        if (!currentStoredId) {
          localStorage.setItem(storageKey, savedSessionId);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user]);



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


  // Render main content based on active tab
  const renderMainContent = () => {
    if (activeTab === "chat") {
      return (
        <motion.div
          className="bg-slate-900/90 backdrop-blur-md rounded-none sm:rounded-xl shadow-xl py-4 sm:py-0 px-0 w-full max-w-full border-0 sm:border border-blue-500/20 min-h-screen relative mb-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="relative z-10 pb-16 sm:pb-24">
            <ChatInterface
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              sendMessageMutation={sendMessage}
              handleEmotionSelect={handleEmotionSelect}
              useWeb={useWeb}
              useDb={useDb}
            />
          </div>
        </motion.div>

      );
    } else if (activeTab === "mindmap") {
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
            <BrainCircuit size={14} />
          </div>
          <div className="absolute top-2 right-2 text-blue-500 opacity-30">
            <Zap size={14} />
          </div>
          <div className="absolute bottom-2 left-2 text-blue-400 opacity-30">
            <Database size={14} />
          </div>
          <div className="absolute bottom-2 right-2 text-blue-500 opacity-30">
            <Cpu size={14} />
          </div>

          <div className="relative z-10 h-full">
            <MindMapGenerator />
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
      {/* Fixed position chat input for chat tab only */}
      {activeTab === "chat" && (
        <div className="fixed bottom-0 md:bottom-5  p-5  md:p-0 left-0 right-0 z-40">
          <div className="max-w-3xl mx-auto ">
            {currentAudioUrl && (
              <AudioPlayer
                audioUrl={currentAudioUrl}
                isPlaying={isPlayingAudio}
                onPlayComplete={handlePlaybackComplete}
              />
            )}

            <AnimatePresence>
              {showTranscriptionConfirmation && transcribedText && (
                <div className="w-full">
                  <TranscriptionConfirmation
                    text={transcribedText}
                    onConfirm={handleConfirmTranscription}
                    onCancel={handleCancelTranscription}
                    onEdit={handleEditTranscription}
                  />
                </div>
              )}
            </AnimatePresence>

            <ChatInput
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              sendMessage={sendMessage}
              useWeb={useWeb}
              setUseWeb={setUseWeb}
              useDb={useDb}
              setUseDb={setUseDb}
              handleVoiceRecording={handleVoiceRecording}
              isProcessingVoice={isProcessingVoice}
            />

          </div>
        </div>
      )}
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

      {/* Improved header for mobile */}
      <Navbar />

      {/* Main content section */}
      <main className="flex-1 w-full max-w-full px-0 pt-16 sm:pt-18">
        {renderMainContent()}
      </main>
      <Footer />


    </div>
  );
}