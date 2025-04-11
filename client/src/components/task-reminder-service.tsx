import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReminderNotification } from "./reminder-notification";
import { isWithinInterval, subMinutes, addMinutes, isBefore } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { Goal } from "@/lib/task-utils";

// Keep track of notified goals and their timestamps
// Using a Map where key is goal ID and value is reminder timestamp to detect changes
const notifiedGoalsCache = new Map<number, string>();

// Track the previous state of goals to detect updates
let previousGoals: Record<number, string> = {};

export function TaskReminderService() {
  const [notifiedGoals, setNotifiedGoals] = useState<number[]>([]);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeNotification, setActiveNotification] = useState<Goal | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<Date>(new Date());
  
  // Get all active goals
  const { data: goals = [] as Goal[] } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
    refetchInterval: 30000, // Check more frequently (every 30 seconds)
    enabled: !!user, // Only fetch if authenticated
  });

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      // Delay asking for permission to avoid overwhelming the user immediately
      const requestTimer = setTimeout(() => {
        Notification.requestPermission();
      }, 5000);
      
      return () => clearTimeout(requestTimer);
    }
  }, []);

  // Find goals with reminders that are due
  const findDueReminders = useCallback((): Goal[] => {
    if (!goals || goals.length === 0) return [];
    
    const now = new Date();
    
    // Check for updated goals and reset their notification status
    const currentGoalsState: Record<number, string> = {};
    
    goals.forEach((goal) => {
      if (goal.reminderTime) {
        currentGoalsState[goal.id] = goal.reminderTime.toString();
        
        // If this goal's reminder time has changed since we last checked,
        // remove it from the notified goals cache so it can trigger again
        if (previousGoals[goal.id] && 
            previousGoals[goal.id] !== goal.reminderTime.toString()) {
          console.log(`[TaskReminder] Goal ${goal.id} reminder time changed, resetting notification status`);
          notifiedGoalsCache.delete(goal.id);
        }
      }
    });
    
    // Update the previous goals state for the next check
    previousGoals = currentGoalsState;
    
    // For debug purposes, log all non-completed goals with reminders
    if (process.env.NODE_ENV === 'development') {
      const reminders = goals.filter(g => g.reminderTime && !g.completed);
      if (reminders.length > 0) {
        console.debug('[TaskReminder] Reminder times:', reminders.map(g => ({
          id: g.id,
          title: g.title,
          reminderTime: new Date(g.reminderTime!).toLocaleString(),
          isPast: new Date(g.reminderTime!) <= now,
          alreadyNotified: notifiedGoalsCache.has(g.id)
        })));
      }
    }
    
    // Get tasks with reminder times that have passed but haven't been notified yet
    // Only include reminders that are in the past or exactly at the current time
    const dueReminders = goals.filter((goal: Goal) => {
      if (!goal.reminderTime || goal.completed) return false;
      
      // Skip goals we've already notified with the same timestamp
      if (notifiedGoalsCache.has(goal.id) && 
          notifiedGoalsCache.get(goal.id) === goal.reminderTime?.toString()) {
        return false;
      }
      
      const reminderTime = new Date(goal.reminderTime);
      
      // Only check for reminders that have occurred (present or past)
      // This ensures we don't show reminders early
      // We still include reminders up to 10 minutes old to catch any that might have been missed
      return reminderTime <= now && 
             reminderTime >= subMinutes(now, 10); // Don't show very old reminders
    });
    
    // Log due reminders
    if (dueReminders.length > 0) {
      console.log('[TaskReminder] Due reminders found:', dueReminders.map(g => g.title));
    }
    
    return dueReminders;
  }, [goals]);

  // Function to check for reminders
  const checkForReminders = useCallback(() => {
    // Don't check if there's already an active notification
    if (activeNotification) return;
    
    const dueReminders = findDueReminders();
    
    if (dueReminders.length > 0) {
      // Sort reminders by time (oldest first)
      dueReminders.sort((a, b) => {
        const timeA = new Date(a.reminderTime!).getTime();
        const timeB = new Date(b.reminderTime!).getTime();
        return timeA - timeB;
      });
      
      // Show the first reminder that's due
      setActiveNotification(dueReminders[0]);
      
      // We'll keep this one in the notified goals set after it's dismissed
    }
    
    lastCheckRef.current = new Date();
  }, [findDueReminders, activeNotification]);
  
  const handleDismissNotification = useCallback((goalId: number) => {
    // Find the goal in the current goals list to get its reminder time
    const goal = goals.find(g => g.id === goalId);
    
    // Add to both local state and persistent cache 
    setNotifiedGoals(prev => [...prev, goalId]);
    
    // Store the reminder time along with the ID so we can detect changes
    if (goal && goal.reminderTime) {
      notifiedGoalsCache.set(goalId, goal.reminderTime.toString());
      console.log(`[TaskReminder] Marked goal ${goalId} as notified with time ${goal.reminderTime}`);
    }
    
    setActiveNotification(null);
    
    // Force a check for new notifications after dismissing one
    // Use timeout to ensure state has updated first
    setTimeout(() => checkForReminders(), 100);
  }, [checkForReminders, goals]);

  // Check for reminders on a regular interval
  useEffect(() => {
    // Don't set up anything if not logged in
    if (!user) return;
    
    // Clear any existing interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    
    // Check immediately on mount or when goals change
    checkForReminders();
    
    // Set up the checking interval (every 15 seconds)
    checkIntervalRef.current = setInterval(() => {
      // Refresh the data first
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      
      // Then check for reminders
      checkForReminders();
    }, 15000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [queryClient, user, goals, checkForReminders]);
  
  // Effect to clean up old notifications from the cache (after 24 hours)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = new Date();
      
      // Clean up notified goals that are more than 24 hours old
      goals.forEach((goal) => {
        if (goal.reminderTime && notifiedGoalsCache.has(goal.id)) {
          const reminderTime = new Date(goal.reminderTime);
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          if (isBefore(reminderTime, oneDayAgo)) {
            notifiedGoalsCache.delete(goal.id);
          }
        }
      });
    }, 60 * 60 * 1000); // Check once per hour
    
    return () => clearInterval(cleanupInterval);
  }, [goals]);
  
  // Only show one notification at a time to avoid overwhelming the user
  return (
    <>
      {activeNotification && (
        <ReminderNotification 
          key={activeNotification.id} 
          goal={activeNotification} 
          onDismiss={handleDismissNotification} 
        />
      )}
    </>
  );
}