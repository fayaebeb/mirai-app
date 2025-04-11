import { useEffect } from "react";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { BellRing } from "lucide-react";
import { format } from "date-fns";
import { Goal } from "@/lib/task-utils";

interface NotificationToastProps {
  goal: Goal;
  onDismiss: (goalId: number) => void;
}

export function NotificationToast({ goal, onDismiss }: NotificationToastProps) {
  const { toast } = useToast();

  useEffect(() => {
    // Play notification sound
    const audio = new Audio('/notification-sound.mp3');
    audio.volume = 0.5;
    try {
      audio.play().catch(e => {
        // Silently fail if browser blocks autoplay
        console.info("Browser blocked autoplay notification sound", e);
      });
    } catch (e) {
      console.info("Failed to play notification sound", e);
    }
    
    // Use toast notification system
    const toastInstance = toast({
      title: "タスクリマインダー",
      description: goal.title + (goal.dueDate ? 
        `\n期限日: ${format(new Date(goal.dueDate), "yyyy-MM-dd")}` : 
        ""),
      duration: 10000, // 10 seconds
    });

    return () => {
      // This doesn't actually work with the current toast implementation
      // but keeping it here in case the toast API is updated in the future
      if (toastInstance && typeof toastInstance === 'object' && 'dismiss' in toastInstance) {
        (toastInstance as any).dismiss();
      }
    };
  }, [goal, onDismiss, toast]);

  return null; // The actual UI is handled by the toast system
}