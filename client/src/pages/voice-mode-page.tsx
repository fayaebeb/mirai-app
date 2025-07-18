import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, ArrowLeft, MessageSquare, AudioLines, Play, Pause, Square, Database, Globe, ChevronDown, Check } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DbType, Message } from "@shared/schema";
import { ChatLoadingIndicator } from "@/components/chat-loading-indicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPortal } from "react-dom";
import DbButton from "@/components/dbbutton";
import ChatMessage from "@/components/chat-message";
import { useRecoilValue } from "recoil";
import { activeChatIdAtom } from "@/states/chatStates";
import { Spotlight } from "@/components/ui/spotlight";
import { useRenameChat } from "@/hooks/useRenameChat";
import { useIsMobile } from "@/hooks/use-mobile";


export default function VoiceModePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string | null>(null);
  const [autoListenTimeout, setAutoListenTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const isMobile = useIsMobile();
  const [useWeb, setUseWeb] = useState(false);
  const [useDb, setUseDb] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedDb, setSelectedDb] = useState<DbType>("db1");
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dbButtonRef = useRef<HTMLButtonElement>(null);

  const activeChatId = useRecoilValue(activeChatIdAtom)

  const [dropdownCoords, setDropdownCoords] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDbDropdownOpen(false);
      }
    }

    if (isDbDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDbDropdownOpen]);




  // Get session ID from local storage
  // const getSessionId = () => {
  //   if (!user?.id) return "";
  //   const storageKey = `chat_session_id_user_${user.id}`;
  //   return localStorage.getItem(storageKey) || "";
  // };
  const renameChat = useRenameChat();

  // Setup WebSocket connection
  useEffect(() => {
    if (!user) return;

    // Create WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    // Create new WebSocket
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Setup event listeners
    ws.addEventListener("open", () => {
      console.log("WebSocket connection established");
      setIsConnected(true);

      // Send auth data to register client
      // const sessionId = getSessionId() || user.email.split('@')[0];
      ws.send(JSON.stringify({
        type: "auth",
        userId: user.id,
        email: user.email,
        chatId: activeChatId
      }));
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);


        switch (data.type) {
          case "connected":
            console.log("Initial connection acknowledged");
            break;

          case "auth_success":
            console.log("Authentication successful");
            toast({
              title: "ボイスモード接続完了",
              description: "音声モードで会話を開始できます",
              duration: 1000,
            });
            break;

          case "transcription":
            console.log("Transcription received:", data.text);
            setCurrentTranscript(data.text);
            break;

          case "ai_response":
            console.log("AI response received:", data.message);

            if (data.userMessage && data.message) {
              setMessages(prev => [
                ...prev,
                { ...data.userMessage, isBot: false },
                { ...data.message, isBot: true }
              ]);
              setCurrentTranscript(null);
              // setTimeout(() => {
              //   messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
              // }, 100);
            }
            break;


          case "speech_response":
            console.log("Speech response received");
            if (data.audioData && isListening) {
              // Stop any currently playing audio
              stopCurrentAudio();

              // Play audio if listening is enabled
              const audio = new Audio(`data:audio/mp3;base64,${data.audioData}`);

              // Store reference to the current audio element
              currentAudioRef.current = audio;

              // Play the audio
              audio.play()
                .then(() => {
                  // Set playing state when audio starts
                  setIsAudioPlaying(true);
                  setIsAudioPaused(false);
                })
                .catch(err => {
                  console.error("Error playing audio:", err);
                  currentAudioRef.current = null;
                  setIsAudioPlaying(false);
                  setIsAudioPaused(false);
                });

              // Setup auto-listen after speech ends
              if (autoListenTimeout) {
                clearTimeout(autoListenTimeout as NodeJS.Timeout);
              }

              audio.addEventListener("ended", () => {
                // Clear reference and states when audio ends
                currentAudioRef.current = null;
                setIsAudioPlaying(false);
                setIsAudioPaused(false);

                if (isListening) {
                  // Auto start listening again after a delay
                  const timeout = setTimeout(() => {
                    if (!isRecording && !isProcessing) {
                      startRecording();
                    }
                  }, 1000);

                  setAutoListenTimeout(timeout);
                }
              });
            }

            // Complete processing
            setIsProcessing(false);
            break;

          case "error":
            console.error("WebSocket error:", data.message);
            toast({
              title: "エラーが発生しました",
              description: data.message,
              variant: "destructive",
              duration: 5000,
            });
            setIsProcessing(false);
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.addEventListener("close", () => {
      console.log("WebSocket connection closed");
      setIsConnected(false);
      toast({
        title: "接続が切断されました",
        description: "ページをリロードして再接続してください",
        variant: "destructive",
      });
    });

    ws.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (autoListenTimeout) {
        clearTimeout(autoListenTimeout);
      }

      // Stop any playing audio when component unmounts
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, [user, toast]);

  // Initialize timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  // Scroll to bottom when messages change
  // useEffect(() => {
  //   messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [messages]);

  // Detect silence to automatically stop recording
  // Detect silence to automatically stop recording
  const setupVoiceActivityDetection = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyzer = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

    analyzer.smoothingTimeConstant = 0.8;
    analyzer.fftSize = 1024;

    microphone.connect(analyzer);
    analyzer.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    // Silence detection variables
    let silenceStart: number | null = null;
    const silenceThreshold = 25; // raised threshold for better sensitivity
    const silenceTimeout = 2000; // 2 seconds

    scriptProcessor.onaudioprocess = () => {
      const array = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteFrequencyData(array);

      const arraySum = array.reduce((acc, val) => acc + val, 0);
      const average = arraySum / array.length;

      if (average < silenceThreshold) {
        if (silenceStart === null) {
          silenceStart = Date.now();
        } else if (Date.now() - silenceStart > silenceTimeout) {
          console.log("Silence detected. Stopping recording.");
          if (isRecording && !isProcessing) {
            stopRecording();
          }

          // Always clean up
          scriptProcessor.disconnect();
          analyzer.disconnect();
          microphone.disconnect();
        }
      } else {
        // Reset silence timer on sound
        silenceStart = null;
      }
    };

    return () => {
      scriptProcessor.disconnect();
      analyzer.disconnect();
      microphone.disconnect();
    };
  };

  const startRecording = async () => {
    if (!isConnected || isProcessing) return;

    // Stop any currently playing audio before starting to record
    stopCurrentAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Reset recording time and audio chunks
      setRecordingTime(0);
      audioChunksRef.current = [];

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Setup voice activity detection
      const cleanupVAD = setupVoiceActivityDetection(stream);

      // Event handler for data available
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Event handler for recording stop
      mediaRecorder.onstop = async () => {
        cleanupVAD();

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          // Set processing state
          setIsProcessing(true);

          try {
            // Convert Blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
              // Extract base64 data from result
              const base64data = reader.result?.toString().split(',')[1];

              if (base64data && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                // Send audio data to server
                wsRef.current.send(JSON.stringify({
                  type: 'speech',
                  audioData: base64data,
                  useweb: useWeb,
                  usedb: useDb,
                  db: selectedDb,
                }));
              } else {
                setIsProcessing(false);
                toast({
                  title: "エラー",
                  description: "音声データの送信に失敗しました",
                  variant: "destructive",
                });
              }
            };
          } catch (error) {
            console.error("Error processing audio:", error);
            setIsProcessing(false);
            toast({
              title: "エラー",
              description: "音声処理に失敗しました",
              variant: "destructive",
            });
          }
        } else {
          // No audio data recorded
          toast({
            title: "録音エラー",
            description: "音声が検出されませんでした。もう一度お試しください。",
            variant: "destructive",
          });
        }

        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      // Start recording with timeslices to collect data
      mediaRecorder.start(1000);
      setIsRecording(true);

    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "録音エラー",
        description: "マイクへのアクセスが許可されていません",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      // The onstop handler will handle the rest

      toast({
        title: "✅ 録音完了",
        description: "音声を処理しています...",
        duration: 1000,
      });
    }
  };

  // Function to stop current audio playback
  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setIsAudioPlaying(false);
      setIsAudioPaused(false);
    }
  };

  // Function to pause current audio playback
  const pauseCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsAudioPlaying(false);
      setIsAudioPaused(true);
    }
  };

  // Function to resume audio playback
  const resumeCurrentAudio = () => {
    if (currentAudioRef.current && isAudioPaused) {
      currentAudioRef.current.play();
      setIsAudioPlaying(true);
      setIsAudioPaused(false);
    }
  };




  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const displayName = user?.email?.split("@")[0];

  return (
    <div className="h-full">
      {/* Connection status */}
      <div className={`flex items-center text-xs leading-none px-3 py-2 rounded-full bg-black border border-noble-black-900 fixed top-6 right-10 z-30 ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
        <div className={`h-2 w-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="whitespace-nowrap">{isConnected ? 'オンライン' : 'オフライン'}</span>
      </div>


      {/* Main content area */}
      <main className="h-full p-1 sm:p-5 flex flex-col w-full ">
        <div className="h-3/4  border-noble-black-900  bg-noble-black-900  rounded-2xl  p-3 border  flex flex-col mb-3 ">
          <Spotlight />

          <div className="h-full  space-y-4 ">
            {messages.length === 0 && !currentTranscript && !isProcessing ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <motion.div
                  className="flex items-center"
                  initial={{ scale: 0.9, y: -10, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                >
                  <motion.img
                    src="/images/mirai.png"
                    alt="桜AI ロゴ"
                    className="h-48 sm:h-48 w-auto"
                    whileHover={{ scale: 1.05, rotate: [-1, 1, -1, 0] }}
                    transition={{ rotate: { duration: 0.5 } }}
                  />
                </motion.div>
                <AudioLines className="h-16 w-16 text-noble-black-100 mb-4" />
                <h3 className="text-lg font-medium text-noble-black-100 mb-2">
                  音声モードへようこそ！
                </h3>
                <p className="text-noble-black-400 max-w-md">
                  下の「録音ボタン」を押して話しかけてください。
                </p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto ">
                {/* Map through messages */}
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isPlayingAudio={false}
                    playingMessageId={null}
                    onPlayAudio={() => { }}
                  />
                ))}

                {/* Current transcript display */}
                {currentTranscript && (
                  <div className="flex flex-col ml-auto max-w-[80%] bg-black p-3 rounded-lg opacity-70">
                    <div className="text-noble-black-100-700 text-sm italic">
                      {currentTranscript}
                    </div>
                  </div>
                )}

                {/* Processing indicator */}
                {isProcessing && (
                  <div className="flex justify-center my-4">
                    <ChatLoadingIndicator variant="minimal" message="返信を生成中..." />
                  </div>
                )}

                {/* Invisible element for auto-scrolling */}
                {/* <div ref={messageEndRef} /> */}
              </div>
            )}
          </div>

        </div>


        {/* Voice control panel */}
        <div className="border-noble-black-900 h-1/4  bg-black border rounded-2xl text-noble-black-100 p-6 sm:p-4 flex">
          <div className="flex flex-col items-center justify-center w-full h-full space-y-2">
            <div className="flex flex-col items-center justify-center gap-2">
              {/* Recording timer */}
              {isRecording && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="animate-pulse text-red-500">●</span>
                  <span>{formatTime(recordingTime)}</span>
                </div>
              )}

              {/* Audio playback controls */}
              {isAudioPlaying || isAudioPaused ? (
                <div className="flex items-center gap-3">
                  {/* Play/Pause button */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={isAudioPaused ? resumeCurrentAudio : pauseCurrentAudio}
                      className="h-8 w-8 md:h-12 md:w-12 rounded-full bg-noble-black-900 text-noble-black-100 hover:bg-noble-black-800"
                    >
                      {isAudioPaused ? (
                        <Play className="h-5 w-5" />
                      ) : (
                        <Pause className="h-5 w-5" />
                      )}
                    </Button>
                  </motion.div>

                  {/* Stop button */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center justify-center "
                  >
                    <Button
                      onClick={stopCurrentAudio}
                      className="h-8 w-8 md:h-12 md:w-12 rounded-full bg-red-500 hover:bg-red-600"
                    >
                      <Square className="h-5 w-5" />
                    </Button>
                  </motion.div>

                  {/* Microphone button */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      disabled={!isConnected || isProcessing}
                      onClick={isRecording ? stopRecording : startRecording}
                      className="h-8 w-8 sm:h-12 sm:w-12 rounded-full bg-noble-black-100 text-noble-black-900 hover:text-noble-black-100 hover:bg-noble-black-900"
                    >
                      {isRecording ? (
                        <MicOff className="h-3 w-3 md:h-5 md:w-5" />
                      ) : (
                        <Mic className="h-3 w-3 md:h-5 md:w-5" />
                      )}
                    </Button>
                  </motion.div>
                </div>
              ) : (
                /* Recording button (when no audio is playing) */
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    disabled={!isConnected || isProcessing}
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`h-8 w-8 md:h-12 md:w-12 rounded-full ${isRecording
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-noble-black-100 text-noble-black-900 hover:text-noble-black-100 hover:bg-noble-black-900'
                      }`}
                  >
                    {isRecording ? (
                      <MicOff className="h-3 w-3 md:h-5 md:w-5" />
                    ) : (
                      <Mic className="h-3 w-3 md:h-5 md:w-5" />
                    )}
                  </Button>
                </motion.div>
              )}

              <p className="text-sm text-noble-black-400 mt-2">
                {isRecording
                  ? "録音中... 話し終わると自動的に停止します"
                  : isProcessing
                    ? "処理中..."
                    : isAudioPlaying || isAudioPaused
                      ? "音声再生中です。録音するには停止してください"
                      : "録音ボタンを押して話しかけてください"}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 ">
              {/* <Button
                onClick={() => setUseWeb(!useWeb)}
                className={`px-4 py-2 rounded-full shadow-md flex items-center gap-1 transition
                ${useWeb
                    ? "bg-noble-black-100 text-noble-black-900 hover:text-noble-black-100 hover:bg-noble-black-900 hover:brightness-105"
                    : "bg-muted text-muted-foreground border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
                hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300
              `}
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">オンライン情報</span>
              </Button> */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setUseWeb(!useWeb);
                }}
                className={`h-8 sm:h-9 flex items-center justify-center flex-shrink-0 transition-all font-medium
                ${isMobile ? "w-8 sm:w-9 rounded-full p-0" : "px-3 py-1.5 rounded-full gap-1"}
                ${useWeb
                    ? "bg-cyan-600/40 text-cyan-400 border border-blue-400 shadow-sm"
                    : "bg-noble-black-900 text-noble-black-300  hover:border-slate-400"
                  }
                hover:ring-1 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70
              `}
              >
                <Globe className="h-4 w-4" />
                {!isMobile && <span className="hidden sm:inline">オンライン</span>}
              </button>

              <DbButton
                useDb={useDb}
                setUseDb={setUseDb}
              />


            </div>
          </div>
        </div>
      </main>
    </div>
  );
}