import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing: boolean;
}

export default function VoiceRecorder({ onRecordingComplete, isProcessing }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Initialize timer for recording duration and cleanup resources
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
      // Clean up timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Clean up MediaRecorder when component unmounts
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);

        // Stop all audio tracks if any exist
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Reset recording time and audio chunks
      setRecordingTime(0);
      audioChunksRef.current = [];

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Event handler for data available
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Event handler for recording stop
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        onRecordingComplete(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

      toast({
        title: "🎤 録音開始",
        description: "マイクに向かって話してください",
        duration: 3000,
      });
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
      setIsRecording(false);

      toast({
        title: "✅ 録音完了",
        description: "音声を処理しています...",
        duration: 3000,
      });
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="flex flex-row-reverse items-center gap-2">
      {/* Recording timer */}
      {isRecording && (
        <AnimatePresence>
        {isRecording && (
          <motion.div
            key="timer"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="flex items-center space-x-2 text-sm font-mono text-indigo-300"
          >
            <motion.span
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-indigo-400"
            >
              ●
            </motion.span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {formatTime(recordingTime)}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
      )}

      {/* Recording button */}
      <Button
        id="voice-mode-button"
        type="button"
        variant={isRecording ? "destructive" : "outline"}
        size="icon"
        className={`h-8 w-8 sm:w-[36px] sm:h-[36px]   rounded-full ${isRecording ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border border-indigo-500 shadow-sm transition-all" : "bg-slate-700 text-slate-300 border border-slate-600 hover:border-slate-400"} hover:bg-gradient-to-r hover:from-indigo-500 hover:to-indigo-600 hover:text-white hover:ring-1 hover:ring-indigo-400 focus:indigo-none focus:ring-2 focus:ring-indigo-500/70`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin  " />
        ) : isRecording ? (
          <MicOff className="h-4 w-4 " />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}