import { Fragment, useEffect, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { BellRing, Check, Clock, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Goal, getCategoryColor, getCategoryName } from "@/lib/task-utils";

interface ReminderNotificationProps {
  goal: Goal;
  onDismiss: (goalId: number) => void;
}

export function ReminderNotification({ goal, onDismiss }: ReminderNotificationProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isSnoozing, setIsSnoozing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClose = () => {
    setIsOpen(false);
    onDismiss(goal.id);
  };

  // Function to snooze reminder for a specified number of minutes
  const snoozeReminder = async (minutesToSnooze: number) => {
    try {
      setIsSnoozing(true);
      
      // Calculate new reminder time
      const now = new Date();
      const newReminderTime = new Date(now.getTime() + minutesToSnooze * 60 * 1000);
      
      // Update the goal with the new reminder time
      await apiRequest('PUT', `/api/goals/${goal.id}`, {
        ...goal,
        reminderTime: newReminderTime
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      
      toast({
        title: "リマインダーをスヌーズしました",
        description: `${minutesToSnooze === 10 ? '10分後' : '1時間後'}に再通知します`,
      });
      
      handleClose();
    } catch (error) {
      console.error("Error snoozing reminder:", error);
      toast({
        title: "エラー",
        description: "リマインダーをスヌーズできませんでした",
        variant: "destructive",
      });
    } finally {
      setIsSnoozing(false);
    }
  };
  
  // Function to snooze reminder until tomorrow at the same time
  const snoozeToTomorrow = async () => {
    try {
      setIsSnoozing(true);
      
      // Calculate tomorrow's date at the same time
      const reminderDate = goal.reminderTime ? new Date(goal.reminderTime) : new Date();
      const tomorrow = new Date(reminderDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Update the goal with the new reminder time
      await apiRequest('PUT', `/api/goals/${goal.id}`, {
        ...goal,
        reminderTime: tomorrow
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      
      toast({
        title: "リマインダーをスヌーズしました",
        description: "明日の同じ時間に再通知します",
      });
      
      handleClose();
    } catch (error) {
      console.error("Error snoozing reminder to tomorrow:", error);
      toast({
        title: "エラー",
        description: "リマインダーをスヌーズできませんでした",
        variant: "destructive",
      });
    } finally {
      setIsSnoozing(false);
    }
  };

  const markAsComplete = async () => {
    try {
      setIsMarkingComplete(true);
      await apiRequest('PUT', `/api/goals/${goal.id}`, {
        ...goal,
        completed: true
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      
      toast({
        title: "タスク完了",
        description: "タスクを完了としてマークしました",
      });
      
      handleClose();
    } catch (error) {
      console.error("Error marking task as complete:", error);
      toast({
        title: "エラー",
        description: "タスクを更新できませんでした",
        variant: "destructive",
      });
    } finally {
      setIsMarkingComplete(false);
    }
  };

  // Function to check if audio can autoplay
  const canAutoplay = async () => {
    const audio = new Audio();
    try {
      // Try to play a silent audio
      audio.muted = true;
      await audio.play();
      audio.pause();
      return true;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    // Play notification sound
    const playNotificationSound = async () => {
      // First check if autoplay is allowed
      const autoplayAllowed = await canAutoplay();
      
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.5;
      
      if (autoplayAllowed) {
        try {
          await audio.play();
          console.log("[TaskReminder] Successfully played notification sound");
        } catch (e) {
          console.info("Failed to play notification sound", e);
        }
      } else {
        console.info("[TaskReminder] Autoplay not allowed in this browser, can't play notification sound");
      }
    };
    
    // Play sound
    playNotificationSound();
    
    // Also show browser notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('タスクリマインダー', {
        body: goal.title,
        icon: '/images/mirai.png'
      });
    }
  }, [goal]);

  return (
    <Fragment>
      <AlertDialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleClose();
        setIsOpen(open);
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-blue-500" />
              <span>タスクリマインダー</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium">{goal.title}</h3>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground">{goal.description}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {goal.category && (
                    <div className="flex items-center gap-1">
                      <div className={`${getCategoryColor(goal.category)} w-2 h-2 rounded-full`} />
                      <span>{getCategoryName(goal.category)}</span>
                    </div>
                  )}
                  
                  {goal.priority && (
                    <div className="flex items-center gap-1">
                      <Badge variant={
                        goal.priority === 'high' ? 'destructive' : 
                        goal.priority === 'medium' ? 'default' : 
                        'outline'
                      } className="px-1 py-0 text-xs h-5">
                        {goal.priority === 'high' ? '高' : 
                         goal.priority === 'medium' ? '中' : '低'}
                      </Badge>
                    </div>
                  )}
                </div>
                
                {goal.dueDate && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      期限日: {format(new Date(goal.dueDate), "yyyy年MM月dd日", { locale: ja })}
                    </span>
                  </div>
                )}
                
                {goal.reminderTime && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <BellRing className="h-4 w-4 text-muted-foreground" />
                    <span>
                      リマインダー: {format(new Date(goal.reminderTime), "yyyy年MM月dd日 HH:mm", { locale: ja })}
                    </span>
                  </div>
                )}
                
                {goal.tags && goal.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {goal.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="px-1 py-0 text-xs h-5">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="w-full mb-4">
            <h4 className="text-sm font-medium mb-2">スヌーズ</h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => snoozeReminder(10)}
                disabled={isSnoozing}
                className={`px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md flex items-center
                  ${isSnoozing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSnoozing ? <span className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-slate-800 border-r-transparent" /> : null}
                <span>10分後</span>
              </button>
              <button
                type="button"
                onClick={() => snoozeReminder(60)}
                disabled={isSnoozing}
                className={`px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md flex items-center
                  ${isSnoozing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSnoozing ? <span className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-slate-800 border-r-transparent" /> : null}
                <span>1時間後</span>
              </button>
              <button
                type="button"
                onClick={() => snoozeToTomorrow()}
                disabled={isSnoozing}
                className={`px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md flex items-center
                  ${isSnoozing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSnoozing ? <span className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-slate-800 border-r-transparent" /> : null}
                <span>明日</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSnoozing}
                className={`px-3 py-1.5 text-xs bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-md flex items-center
                  ${isSnoozing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span>二度と表示しない</span>
              </button>
            </div>
          </div>
          
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogAction 
              onClick={markAsComplete}
              disabled={isMarkingComplete || isSnoozing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isMarkingComplete 
                ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" /> 
                : <Check className="mr-2 h-4 w-4" />
              }
              完了としてマーク
            </AlertDialogAction>
            
            {/* Debug button only visible in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="w-full flex justify-center mt-2">
                <button 
                  type="button"
                  onClick={() => {
                    handleClose();
                    console.log(`[DEBUG] Dismissing goal ${goal.id} without caching it`);
                    window.localStorage.setItem('last-debug-goal-dismiss', String(goal.id));
                  }}
                  className="text-xs text-muted-foreground underline"
                >
                  (Debug: Dismiss without caching)
                </button>
              </div>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Fragment>
  );
}