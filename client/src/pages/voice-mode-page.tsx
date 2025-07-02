import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, ArrowLeft, MessageSquare, AudioLines, Play, Pause, Square, Database, Globe, ChevronDown, Check } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "@shared/schema";
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

  const [useWeb, setUseWeb] = useState(false);
  const [useDb, setUseDb] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedDb, setSelectedDb] = useState("files");
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dbButtonRef = useRef<HTMLButtonElement>(null);
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
  const getSessionId = () => {
    if (!user?.id) return "";
    const storageKey = `chat_session_id_user_${user.id}`;
    return localStorage.getItem(storageKey) || "";
  };

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
      const sessionId = getSessionId() || user.email.split('@')[0];
      ws.send(JSON.stringify({
        type: "auth",
        userId: user.id,
        email: user.email,
        sessionId
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
              setTimeout(() => {
                messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
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
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-blue-900/50 bg-slate-950/90 backdrop-blur-lg shadow-md sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-blue-700 hover:bg-blue-50">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="font-medium text-lg text-blue-700 break-words truncate sm:truncate sm:whitespace-nowrap">
              ボイスモード
            </div>

          </div>

          <div className="flex items-center space-x-2">
            {/* Connection status */}
            <div className={`flex items-center text-xs leading-none ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
              <div className={`h-2 w-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="whitespace-nowrap">{isConnected ? 'オンライン' : 'オフライン'}</span>
            </div>



            {/* Text mode link */}
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">テキストモード</span>
              </Button>
            </Link>
          </div>

        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 container mx-auto px-4 py-2 flex flex-col overflow-hidden ">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 border-blue-600/20 shadow-lg shadow-blue-900/10 bg-gradient-to-b from-slate-950 to-slate-900  rounded-2xl  p-3 border  flex flex-col overflow-hidden mb-3">

            <ScrollArea className="h-full pr-2 sm:pr-4" viewportRef={messageEndRef}>

              <div className="flex-1 overflow-y-auto pr-2 sm:pr-4 space-y-4 pb-4">
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
                    <AudioLines className="h-16 w-16 text-blue-200 mb-4" />
                    <h3 className="text-lg font-medium text-blue-700 mb-2">
                      音声モードへようこそ！
                    </h3>
                    <p className="text-blue-500 max-w-md">
                      下の「録音ボタン」を押して話しかけてください。
                    </p>
                  </div>
                ) : (
                  <>
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
                      <div className="flex flex-col ml-auto max-w-[80%] bg-blue-700 p-3 rounded-lg opacity-70">
                        <div className="text-blue-700 text-sm italic">
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
                    <div ref={messageEndRef} />
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Voice control panel */}
        <div className="border-blue-600/20 shadow-lg shadow-blue-900/10 bg-gradient-to-t from-slate-950 to-slate-900 rounded-2xl p-4 border flex flex-col items-center">
          <div className="flex flex-col items-center gap-2">
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
                    className="h-12 w-12 rounded-full bg-blue-500 hover:bg-blue-600"
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
                >
                  <Button
                    onClick={stopCurrentAudio}
                    className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600"
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
                    className="h-12 w-12 rounded-full bg-blue-500 hover:bg-blue-600"
                  >
                    {isRecording ? (
                      <MicOff className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
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
                  className={`h-16 w-16 rounded-full ${isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                >
                  {isRecording ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </Button>
              </motion.div>
            )}

            <p className="text-sm text-blue-600 mt-2">
              {isRecording
                ? "録音中... 話し終わると自動的に停止します"
                : isProcessing
                  ? "処理中..."
                  : isAudioPlaying || isAudioPaused
                    ? "音声再生中です。録音するには停止してください"
                    : "録音ボタンを押して話しかけてください"}
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => setUseWeb(!useWeb)}
              className={`px-4 py-2 rounded-full shadow-md flex items-center gap-1 transition
                ${useWeb
                  ? "bg-gradient-to-r from-blue-400 to-blue-500 text-white border border-blue-500 hover:brightness-105"
                  : "bg-muted text-muted-foreground border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
                hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300
              `}
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">オンライン情報</span>
            </Button>

            <DbButton
              useDb={useDb}
              setUseDb={setUseDb}
              selectedDb={selectedDb}
              setSelectedDb={setSelectedDb}
            />


          </div>
        </div>
      </main>
    </div>
  );
}