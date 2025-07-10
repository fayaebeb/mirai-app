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
import { DbType, Message } from "@shared/schema";
import { NotesList } from "@/components/notes-list";
import { EnhancedTaskTracker } from "@/components/enhanced-task-tracker";
import { GoalChatInterface } from "@/components/goal-chat-interface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { nanoid } from "nanoid";
import Footer from "@/components/Footer";
import { useRecoilState, useRecoilValue } from "recoil";
import { ActiveTab, activeTabState } from "@/states/activeTabState";
import Navbar from "@/components/Navbar";
import TranscriptionConfirmation from "@/components/transcription-confirmation";
import { currentAudioUrlAtom, isPlayingAudioAtom, isProcessingVoiceAtom, playingMessageIdAtom } from "@/states/voicePlayerStates";
import { activeChatIdAtom } from "@/states/chatStates";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import FloatingSidebar from "@/components/Sidepanel";
import { useRenameChat } from "@/hooks/useRenameChat";
import VoiceModePage from "./voice-mode-page";

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
  const [hasEntered, setHasEntered] = useState(false);
  const [selectedDb, setSelectedDb] = useState<DbType>("うごき統計");

  const activeChatId = useRecoilValue(activeChatIdAtom)


  const CHAT_SESSION_KEY_PREFIX = "chat_session_id_user_";
  const chatKey = ["/api/chats", activeChatId, "messages"] as const;
  // Get messages for PDF export


  // Send message mutation with optimistic updates
  const sendMessage = useMutation<
    Message,
    Error,
    { content: string; useWeb: boolean; useDb: boolean; dbType: DbType },
    { previousMessages?: Message[] }
  >({
    mutationFn: async ({ content, useWeb, useDb, dbType }) => {
      if (!activeChatId) throw new Error("チャットが選択されていません。");
      const response = await apiRequest(
        "POST",
        `/api/messages`,
        { content, useWeb, useDb, isBot: false, chatId: activeChatId, dbType }
      );
      return response.json();
    },

    onMutate: async ({ content }) => {
      if (!activeChatId) throw new Error("チャットが選択されていません。");

      await queryClient.cancelQueries({ queryKey: chatKey });
      const previousMessages = queryClient.getQueryData<Message[]>(chatKey);

      const tempUserMessage: Message = {
        id: -Date.now(),
        userId: user!.id,
        chatId: activeChatId,
        content,
        isBot: false,
        createdAt: new Date(),
        dbType: selectedDb
      };

      queryClient.setQueryData<Message[]>(chatKey, (old = []) => [
        ...old,
        tempUserMessage
      ]);

      return { previousMessages };
    },

    onSuccess: (newBotMessage: Message) => {
      setInput("");
      queryClient.setQueryData<Message[]>(chatKey, (old = []) => [
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
      queryClient.invalidateQueries({ queryKey: chatKey });
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
        dbType: selectedDb
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
  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();

  //   if (!input.trim() || sendMessage.isPending || !activeChatId) return;

  //   // Clear immediately
  //   setInput("");

  //   sendMessage.mutate({ content: input, useWeb, useDb });
  // };
  const renameChat = useRenameChat();
  const {
    data: messages = [],
    isLoading: loadingMsgs,
    error: msgsError,
  } = useQuery<Message[]>({
    queryKey: ["/api/chats", activeChatId, "messages"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/chats/${activeChatId}/messages`);
      if (!res.ok) throw new Error("メッセージの取得に失敗しました。");
      return res.json() as Promise<Message[]>;
    },
    enabled: !!activeChatId,
    staleTime: 5 * 60_000,   // 5 minutes in cache so you aren’t refetching constantly
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sendMessage.isPending || !activeChatId) return;

    setInput(""); // clear immediately

    sendMessage.mutate(
      { content, useWeb, useDb, dbType: selectedDb, },   // ← only these three props
      {
        onSuccess: () => {
          // 1) rename if this was the very first message
          if (messages.length === 0 && activeChatId) {
            renameChat.mutate({
              chatId: activeChatId,
              title: content,
            });
          }

          // 2) refetch your messages
          queryClient.invalidateQueries({
            queryKey: ["/api/chats", activeChatId, "messages"],
          });
        },
      }
    );
  };
  const handleEnterComplete = () => {
    if (!hasEntered) setHasEntered(true);
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
          className="h-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <ChatInterface
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            sendMessageMutation={sendMessage}
            handleEmotionSelect={handleEmotionSelect}
            useWeb={useWeb}
            useDb={useDb}
            dbType={selectedDb}
          />
        </motion.div>

      );
    } else if (activeTab === "mindmap") {
      return (
        <motion.div
          className="h-full p-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="relative z-10 h-full">
            <MindMapGenerator />
          </div>
        </motion.div>
      );
    } else if (activeTab === "notes") {
      return (
        <motion.div
          className="h-full p-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >


          <div className="z-10 h-full">
            <NotesList />
          </div>
        </motion.div>
      );
    } else if (activeTab === "goals") {
      return (
        <motion.div
          className="h-full p-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >

          <div className="relative z-10 h-full">
            <div className="h-full flex flex-col md:flex-row gap-4">
              {/* Mobile tabs to switch between goal tracker and chat */}
              <div className="flex md:hidden mb-2">
                <Tabs defaultValue="tracker" className="w-full">
                  <TabsList className="bg-black border border-noble-black-900 w-full sticky top-0 z-10">
                    <TabsTrigger value="tracker" className="flex-1 gap-1.5">
                      <Target className="h-3.5 w-3.5" />
                      <span>タスク</span>
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="flex-1 gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      <span>アシスタント</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tracker" className="mt-2 h-full overflow-y-auto">
                    <EnhancedTaskTracker />
                  </TabsContent>

                  <TabsContent value="chat" className="mt-2 h-full overflow-hidden">
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
                <div className="md:w-2/3 h-full border-l border-noble-black-800 pl-4">
                  <GoalChatInterface />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      );
    } else if (activeTab === "voice") {
      return (
        <VoiceModePage />
      )
    }
    return null;
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Fixed position chat input for chat tab only */}

      {/* Main content section */}
      <main className="h-full  overflow-y-auto ">
        {renderMainContent()}
      </main>



      {
        activeTab === "chat" && (

          <motion.div
            // animate layout shifts whenever <main>’s width changes
            layout
            // only run this “initial” on the *very* first mount
            initial={!hasEntered ? { opacity: 0, y: 50, scale: 0.8 } : false}
            // this is the state it settles into
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              // entrance: a snappy spring
              type: "spring",
              stiffness: 350,
              damping: 30,
            }}
            // after entrance finishes, don’t ever re-use `initial` again
            onAnimationComplete={handleEnterComplete}
            className="w-full h-fit flex flex-col items-center justify-center md:pb-2"
          >
            {currentAudioUrl && (
              <AudioPlayer
                audioUrl={currentAudioUrl}
                isPlaying={isPlayingAudio}
                onPlayComplete={handlePlaybackComplete}
              />
            )}

            <AnimatePresence>
              {showTranscriptionConfirmation && transcribedText && (
                <div className="w-fit  md:mx-auto">
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
              selectedDb={selectedDb}
              setSelectedDb={setSelectedDb}
              handleVoiceRecording={handleVoiceRecording}
              isProcessingVoice={isProcessingVoice}
            />

          </motion.div>

        )
      }
    </div>


  );
}