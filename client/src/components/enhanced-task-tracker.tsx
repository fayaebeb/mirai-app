import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Goal, InsertGoal } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { 
  Check, Plus, Target, Trash2, Calendar, Rocket, Award, Clock, 
  TrendingUp, Zap, ArrowUpCircle, Edit2, Tag, AlertTriangle, 
  Filter, RefreshCw, ChevronDown, SearchIcon, X, Bell
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays, isBefore, addDays, addWeeks, addMonths } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ja } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import TimePicker from 'react-time-picker';

// Define type for task categories
type TaskCategory = {
  id: string;
  name: string;
  color: string;
};

// Define preset task categories
const defaultCategories: TaskCategory[] = [
  { id: "work", name: "仕事", color: "bg-blue-500" },
  { id: "personal", name: "個人", color: "bg-green-500" },
  { id: "health", name: "健康", color: "bg-red-500" },
  { id: "education", name: "教育", color: "bg-purple-500" },
  { id: "finance", name: "財務", color: "bg-yellow-500" },
  { id: "other", name: "その他", color: "bg-gray-500" },
];

// Define priority option types with colors and icons
type PriorityType = "high" | "medium" | "low";

const priorityOptions = [
  { value: "high" as PriorityType, label: "高", color: "text-red-500", bgColor: "bg-red-100", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { value: "medium" as PriorityType, label: "中", color: "text-amber-500", bgColor: "bg-amber-100", icon: <Target className="h-3.5 w-3.5" /> },
  { value: "low" as PriorityType, label: "低", color: "text-green-500", bgColor: "bg-green-100", icon: <Check className="h-3.5 w-3.5" /> },
];

// Define recurring types
type RecurringType = "daily" | "weekly" | "monthly" | "custom";

const recurringOptions = [
  { value: "daily" as RecurringType, label: "毎日" },
  { value: "weekly" as RecurringType, label: "毎週" },
  { value: "monthly" as RecurringType, label: "毎月" },
  { value: "custom" as RecurringType, label: "カスタム" },
];

// Function to get priority details by value
const getPriorityDetails = (priority: string | null | undefined): typeof priorityOptions[0] => {
  if (!priority) return priorityOptions[1]; // Default to medium
  return priorityOptions.find(option => option.value === priority) || priorityOptions[1]; // Default to medium
};

// Function to get the next due date based on recurring settings
const getNextDueDate = (currentDueDate: Date, recurringType: RecurringType | string | null | undefined, recurringInterval: number = 1): Date => {
  switch (recurringType) {
    case "daily":
      return addDays(currentDueDate, recurringInterval);
    case "weekly":
      return addWeeks(currentDueDate, recurringInterval);
    case "monthly":
      return addMonths(currentDueDate, recurringInterval);
    case "custom":
      return addDays(currentDueDate, recurringInterval);
    default:
      return currentDueDate;
  }
};

export function EnhancedTaskTracker() {
  // Type conversion functions for select components
  const handlePriorityChange = (value: string) => {
    setPriority(value as PriorityType);
  };

  const handleRecurringTypeChange = (value: string) => {
    setRecurringType(value as RecurringType);
  };
  // States for form inputs
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [reminderTime, setReminderTime] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<PriorityType>("medium");
  const [category, setCategory] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringType, setRecurringType] = useState<RecurringType>("daily");
  const [recurringInterval, setRecurringInterval] = useState<number>(1);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);
  
  // UI states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDueDate, setFilterDueDate] = useState<string | null>(null);
  const [currentEditingGoal, setCurrentEditingGoal] = useState<Goal | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch goals
  const { data: goals = [], isLoading, error } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
    refetchOnWindowFocus: true,
  });

  // Filter and sort goals based on filters
  const filteredGoals = goals.filter(goal => {
    // Text search filter
    const searchFilter = searchQuery
      ? goal.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        goal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    
    // Priority filter
    const priorityFilter = filterPriority ? goal.priority === filterPriority : true;
    
    // Category filter
    const categoryFilter = filterCategory ? goal.category === filterCategory : true;
    
    // Status filter
    const statusFilter = filterStatus === "completed" 
      ? goal.completed 
      : filterStatus === "active" 
        ? !goal.completed 
        : true;
    
    // Due date filter
    let dueDateFilter = true;
    if (filterDueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (filterDueDate === "today") {
        dueDateFilter = goal.dueDate ? 
          new Date(goal.dueDate).toDateString() === today.toDateString() : false;
      } else if (filterDueDate === "tomorrow") {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueDateFilter = goal.dueDate ? 
          new Date(goal.dueDate).toDateString() === tomorrow.toDateString() : false;
      } else if (filterDueDate === "week") {
        const weekLater = new Date(today);
        weekLater.setDate(weekLater.getDate() + 7);
        dueDateFilter = goal.dueDate ? 
          new Date(goal.dueDate) >= today && new Date(goal.dueDate) <= weekLater : false;
      } else if (filterDueDate === "overdue") {
        dueDateFilter = goal.dueDate ? 
          new Date(goal.dueDate) < today && !goal.completed : false;
      }
    }
    
    return searchFilter && priorityFilter && categoryFilter && statusFilter && dueDateFilter;
  });
  
  // Group the filtered goals
  const activeGoals = filteredGoals.filter(goal => !goal.completed);
  const completedGoals = filteredGoals.filter(goal => goal.completed);
  
  // Get unique categories from all goals for filter dropdown
  const uniqueCategories = Array.from(new Set(goals.map(goal => goal.category).filter(Boolean))) as string[];
  
  // Create goal mutation
  const createGoal = useMutation({
    mutationFn: async () => {
      // For createGoal, the priority and recurringType are properly typed from state
      // Since they come from the Select handlers, but we add validation for safety
      const newGoal: Partial<InsertGoal> = {
        title: taskTitle.trim(),
        description: taskDescription.trim() || "",
        completed: false,
        dueDate: dueDate,
        priority: priority, // Already strongly typed from state
        category: category || "",
        tags: tags.length > 0 ? tags : [],
        reminderTime: reminderTime,
        isRecurring: isRecurring,
        recurringType: isRecurring ? recurringType : "daily", // Already strongly typed
        recurringInterval: isRecurring ? recurringInterval : 1,
        recurringEndDate: isRecurring ? recurringEndDate : null
      };
      
      const response = await apiRequest('POST', '/api/goals', newGoal);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      resetForm();
      setIsAddDialogOpen(false);
      toast({
        title: "タスクを追加しました",
        description: "新しいタスクが追加されました。",
      });
    },
    onError: (error) => {
      console.error("Error creating goal:", error);
      toast({
        title: "エラーが発生しました",
        description: "タスクの追加に失敗しました。もう一度お試しください。",
        variant: "destructive"
      });
    }
  });

  // Update goal completion status mutation
  const updateGoalStatus = useMutation({
    mutationFn: async ({ id, completed }: { id: number, completed: boolean }) => {
      const goal = goals.find(g => g.id === id);
      if (!goal) throw new Error("Goal not found");
      
      // For recurring tasks, create a new instance if marking complete
      if (goal.isRecurring && completed && goal.dueDate) {
        // Only create new recurring instance if task is marked as complete
        if (completed) {
          const nextDueDate = getNextDueDate(
            new Date(goal.dueDate), 
            goal.recurringType || "daily", 
            goal.recurringInterval || 1
          );
          
          // Check if we've reached the recurring end date
          const shouldCreateNewInstance = !goal.recurringEndDate || 
            (nextDueDate <= new Date(goal.recurringEndDate));
            
          if (shouldCreateNewInstance) {
            // Create a new instance with the next due date
            // Ensure priority is one of the valid enum values
            let priorityValue: PriorityType = "medium";
            if (goal.priority === "high" || goal.priority === "medium" || goal.priority === "low") {
              priorityValue = goal.priority;
            }
            
            // Ensure recurringType is one of the valid enum values
            let recurringTypeValue: RecurringType | undefined = undefined;
            if (goal.isRecurring) {
              if (goal.recurringType === "daily" || goal.recurringType === "weekly" || 
                  goal.recurringType === "monthly" || goal.recurringType === "custom") {
                recurringTypeValue = goal.recurringType;
              } else {
                recurringTypeValue = "daily"; // Default
              }
            }
            
            const newGoalData: Partial<InsertGoal> = {
              title: goal.title || "",
              description: goal.description || "",
              completed: false,
              dueDate: nextDueDate,
              priority: priorityValue,
              category: goal.category || "",
              tags: goal.tags || [],
              reminderTime: goal.reminderTime ? new Date(nextDueDate.setHours(
                new Date(goal.reminderTime).getHours(),
                new Date(goal.reminderTime).getMinutes()
              )) : undefined,
              isRecurring: goal.isRecurring || false,
              recurringType: recurringTypeValue,
              recurringInterval: goal.recurringInterval || 1,
              recurringEndDate: goal.recurringEndDate
            };
            
            await apiRequest('POST', '/api/goals', newGoalData);
          }
        }
      }

      // Ensure priority is one of the valid enum values
      let priorityValue: PriorityType = "medium";
      if (goal.priority === "high" || goal.priority === "medium" || goal.priority === "low") {
        priorityValue = goal.priority;
      }
      
      // Ensure recurringType is one of the valid enum values
      let recurringTypeValue: RecurringType | undefined = undefined;
      if (goal.isRecurring) {
        if (goal.recurringType === "daily" || goal.recurringType === "weekly" || 
            goal.recurringType === "monthly" || goal.recurringType === "custom") {
          recurringTypeValue = goal.recurringType;
        } else {
          recurringTypeValue = "daily"; // Default
        }
      }
      
      const updateData: Partial<InsertGoal> = {
        title: goal.title || "",
        description: goal.description || "",
        completed: completed,
        dueDate: goal.dueDate,
        priority: priorityValue,
        category: goal.category || "",
        tags: goal.tags || [],
        reminderTime: goal.reminderTime,
        isRecurring: goal.isRecurring || false,
        recurringType: recurringTypeValue,
        recurringInterval: goal.recurringInterval || 1,
        recurringEndDate: goal.recurringEndDate
      };
      
      const response = await apiRequest('PUT', `/api/goals/${id}`, updateData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
    },
    onError: (error) => {
      console.error("Error updating goal:", error);
      toast({
        title: "エラーが発生しました",
        description: "タスクの更新に失敗しました。もう一度お試しください。",
        variant: "destructive"
      });
    }
  });

  // Update goal details mutation
  const updateGoalDetails = useMutation({
    mutationFn: async () => {
      if (!currentEditingGoal) throw new Error("No goal selected for editing");
      
      const updateData: Partial<InsertGoal> = {
        title: taskTitle.trim(),
        description: taskDescription.trim() || "",
        completed: currentEditingGoal.completed,
        dueDate: dueDate,
        priority: priority,
        category: category || "",
        tags: tags.length > 0 ? tags : [],
        reminderTime: reminderTime,
        isRecurring: isRecurring,
        recurringType: isRecurring ? recurringType : "daily", // Provide default if not recurring
        recurringInterval: isRecurring ? recurringInterval : 1, // Provide default if not recurring
        recurringEndDate: isRecurring ? recurringEndDate : null
      };
      
      const response = await apiRequest('PUT', `/api/goals/${currentEditingGoal.id}`, updateData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      resetForm();
      setIsEditDialogOpen(false);
      setCurrentEditingGoal(null);
      toast({
        title: "タスクを更新しました",
        description: "タスクが正常に更新されました。",
      });
    },
    onError: (error) => {
      console.error("Error updating goal details:", error);
      toast({
        title: "エラーが発生しました",
        description: "タスクの更新に失敗しました。もう一度お試しください。",
        variant: "destructive"
      });
    }
  });

  // Delete goal mutation
  const deleteGoal = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/goals/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      toast({
        title: "タスクを削除しました",
        description: "タスクが削除されました。",
      });
    },
    onError: (error) => {
      console.error("Error deleting goal:", error);
      toast({
        title: "エラーが発生しました",
        description: "タスクの削除に失敗しました。もう一度お試しください。",
        variant: "destructive"
      });
    }
  });

  // Reset form function
  const resetForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setDueDate(undefined);
    setReminderTime(undefined);
    setPriority("medium");
    setCategory("");
    setTags([]);
    setNewTag("");
    setIsRecurring(false);
    setRecurringType("daily");
    setRecurringInterval(1);
    setRecurringEndDate(undefined);
  };

  // Handle the edit task action
  const handleEditTask = (goal: Goal) => {
    setCurrentEditingGoal(goal);
    setTaskTitle(goal.title || "");
    setTaskDescription(goal.description || "");
    setDueDate(goal.dueDate ? new Date(goal.dueDate) : undefined);
    setReminderTime(goal.reminderTime ? new Date(goal.reminderTime) : undefined);
    setPriority((goal.priority as PriorityType) || "medium");
    setCategory(goal.category || "");
    setTags(goal.tags || []);
    setIsRecurring(goal.isRecurring || false);
    setRecurringType((goal.recurringType as RecurringType) || "daily");
    setRecurringInterval(goal.recurringInterval || 1);
    setRecurringEndDate(goal.recurringEndDate ? new Date(goal.recurringEndDate) : undefined);
    setIsEditDialogOpen(true);
  };

  // Handle form submission for create
  const handleSubmitNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast({
        title: "タイトルを入力してください",
        description: "タスクのタイトルは必須です。",
        variant: "destructive"
      });
      return;
    }
    createGoal.mutate();
  };

  // Handle form submission for update
  const handleSubmitUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast({
        title: "タイトルを入力してください",
        description: "タスクのタイトルは必須です。",
        variant: "destructive"
      });
      return;
    }
    updateGoalDetails.mutate();
  };

  // Handle adding a new tag
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  // Handle removing a tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle pressing Enter in tag input
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery("");
    setFilterPriority(null);
    setFilterCategory(null);
    setFilterStatus(null);
    setFilterDueDate(null);
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  };

  // Get task status (overdue, soon, etc.)
  const getTaskStatus = (goal: Goal) => {
    if (!goal.dueDate) return null;
    const dueDate = new Date(goal.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isBefore(dueDate, today) && !goal.completed) {
      return "overdue";
    }
    
    const daysUntilDue = differenceInDays(dueDate, today);
    if (daysUntilDue >= 0 && daysUntilDue <= 3 && !goal.completed) {
      return "soon";
    }
    
    return null;
  };

  // Get all tasks that are due soon
  const dueSoonTasks = activeGoals.filter(goal => {
    const status = getTaskStatus(goal);
    return status === "soon";
  });

  // Get all overdue tasks
  const overdueTasks = activeGoals.filter(goal => {
    const status = getTaskStatus(goal);
    return status === "overdue";
  });

  // Get regular active tasks (not soon or overdue)
  const regularActiveTasks = activeGoals.filter(goal => {
    const status = getTaskStatus(goal);
    return status !== "soon" && status !== "overdue";
  });

  // Calculate stats
  const totalTasks = filteredGoals.length;
  const completionRate = totalTasks > 0 ? Math.round((completedGoals.length / totalTasks) * 100) : 0;

  // Find category color
  const getCategoryColor = (categoryId: string | undefined): string => {
    if (!categoryId) return "bg-gray-500";
    const category = defaultCategories.find(c => c.id === categoryId);
    return category ? category.color : "bg-gray-500";
  };

  // Get category name
  const getCategoryName = (categoryId: string | undefined): string => {
    if (!categoryId) return "未分類";
    const category = defaultCategories.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
  };

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded-md">
        タスクの読み込み中にエラーが発生しました。
      </div>
    );
  }

  return (
                  <Card className="w-full h-full flex flex-col overflow-hidden flex-grow">
                    <CardHeader className="pb-2 relative flex-shrink-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Target className="h-5 w-5 text-blue-500" />
                            <motion.div
                              className="absolute inset-0 rounded-full border border-blue-500/20"
                              animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.2, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          </div>
                          <CardTitle className="text-base sm:text-lg w-full text-left sm:text-center break-words sm:break-keep">
                            タスク管理
                          </CardTitle>
                        </div>

                        {/* ここがポイント */}
                        <div className="flex flex-row sm:flex-col sm:items-end gap-2 mt-1 sm:mt-0">
                          {!isLoading && filteredGoals.length > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-blue-500/10 h-6">
                              <Award className="h-3 w-3 text-blue-400" />
                              <span className="text-xs">{completionRate}% 達成</span>
                            </Badge>
                          )}

                          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                size={isMobile ? "sm" : "default"}
                                variant="outline"
                                className={cn(
                                  "gap-1",
                                  isMobile && "h-8 px-2 text-xs"
                                )}
                              >
                                <Plus className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                                <span>新規タスク</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-full max-w-sm sm:max-w-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>新しいタスクを追加</DialogTitle>
                                <DialogDescription>
                                  タスクの詳細を入力して、追加してください。
                                </DialogDescription>
                              </DialogHeader>
                
                <form onSubmit={handleSubmitNewTask} className="space-y-4 mt-2">
                  {/* Basic Task Info */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="task-title">タイトル <span className="text-red-500">*</span></Label>
                      <Input 
                        id="task-title"
                        value={taskTitle} 
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="タスクのタイトルを入力" 
                        autoFocus
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="task-description">詳細な説明</Label>
                      <Textarea 
                        id="task-description"
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        placeholder="タスクの詳細を入力"
                        className="min-h-[100px]"
                      />
                    </div>
                  </div>
                  
                  {/* Task metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="task-priority">優先度</Label>
                      <Select value={priority} onValueChange={handlePriorityChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="優先度を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map(option => (
                            <SelectItem 
                              key={option.value} 
                              value={option.value} 
                              className="flex items-center gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`${option.bgColor} p-1 rounded-full`}>
                                  {option.icon}
                                </span>
                                <span className={option.color}>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="task-category">カテゴリ</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="カテゴリを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {defaultCategories.map(option => (
                            <SelectItem 
                              key={option.id} 
                              value={option.id} 
                              className="flex items-center gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`${option.color} w-3 h-3 rounded-full`}></span>
                                <span>{option.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Due date and reminder */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>期限日</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dueDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {dueDate ? format(dueDate, "yyyy年MM月dd日", { locale: ja }) : "期限日を選択"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={dueDate}
                            onSelect={setDueDate}
                            initialFocus
                            locale={ja}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between h-6 mb-1">
                        <Label htmlFor="task-reminder">リマインダー</Label>
                        {reminderTime ? (
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs" 
                            onClick={() => setReminderTime(undefined)}
                          >
                            <X className="h-3 w-3 mr-1" />
                            クリア
                          </Button>
                        ) : (
                          // Invisible placeholder to reserve space
                  <div className="w-[40px] h-[16px] invisible" aria-hidden="true">.</div>

                        )}
                      </div>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-10 flex items-center justify-start gap-2 text-left font-normal leading-none", // <- `h-10` & `leading-none`!
                              !reminderTime && "text-muted-foreground"
                            )}
                          >
                            <Bell className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {reminderTime
                                ? format(reminderTime, "yyyy年MM月dd日 HH:mm", { locale: ja })
                                : "リマインダーを設定"}
                            </span>
                          </Button>
                        </PopoverTrigger>




                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-4 space-y-4">
                            {/* Calendar */}
                            <CalendarComponent
                              mode="single"
                              selected={reminderTime}
                              onSelect={(date) =>
                                setReminderTime(
                                  date
                                    ? new Date(date.setHours(
                                        reminderTime?.getHours() ?? new Date().getHours(),
                                        reminderTime?.getMinutes() ?? new Date().getMinutes()
                                      ))
                                    : undefined
                                )
                              }
                              initialFocus
                              locale={ja}
                            />

                            {/* Custom Time Picker */}
                            {reminderTime && (
                  <div className="flex items-center justify-center space-x-2">
                    {/* Hour */}
                    <Select value={String(reminderTime.getHours())} onValueChange={(val) => {
                      const newDate = new Date(reminderTime);
                      newDate.setHours(Number(val));
                      setReminderTime(newDate);
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="時" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }).map((_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {i.toString().padStart(2, "0")} 時
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-900 dark:text-gray-300">時</span>

                    {/* Minute */}
                    <Select
                      value={String(reminderTime.getMinutes())}
                      onValueChange={(val) => {
                        const newDate = new Date(reminderTime);
                        newDate.setMinutes(Number(val));
                        setReminderTime(newDate);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="分" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 60 }).map((_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {i.toString().padStart(2, "0")} 分
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-900 dark:text-gray-300">分</span>
                  </div>

                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                    </div>
                  </div>
                  
                  {/* Tags */}
                  <div>
                    <Label htmlFor="task-tags">タグ</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="gap-1 pl-2">
                          {tag}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                            onClick={() => handleRemoveTag(tag)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="task-tags"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="新しいタグを入力"
                        className="flex-1"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleAddTag}
                        disabled={!newTag.trim()}
                      >
                        追加
                      </Button>
                    </div>
                  </div>
                  
                  {/* Recurring Options */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="recurring-task"
                        checked={isRecurring}
                        onCheckedChange={setIsRecurring}
                      />
                      <Label htmlFor="recurring-task">繰り返しタスク</Label>
                    </div>
                    
                    {isRecurring && (
                      <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="recurring-type">繰り返しの種類</Label>
                            <Select value={recurringType} onValueChange={handleRecurringTypeChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="繰り返しの種類を選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {recurringOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor="recurring-interval">
                              間隔
                              {recurringType === 'daily' && ' (日)'}
                              {recurringType === 'weekly' && ' (週)'}
                              {recurringType === 'monthly' && ' (月)'}
                              {recurringType === 'custom' && ' (日)'}
                            </Label>
                            <Input
                              id="recurring-interval"
                              type="number"
                              min="1"
                              value={recurringInterval}
                              onChange={(e) => setRecurringInterval(parseInt(e.target.value) || 1)}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between">
                            <Label>繰り返し終了日</Label>

                            {recurringEndDate ? (
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-xs" 
                                onClick={() => setRecurringEndDate(undefined)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                クリア
                              </Button>
                            ) : (
                              // Invisible placeholder to reserve space
                              <div className="w-[40px] h-[30px] invisible" aria-hidden="true">
                                .
                              </div>
                            )}
                          </div>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !recurringEndDate && "text-muted-foreground"
                                )}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {recurringEndDate ? format(recurringEndDate, "yyyy年MM月dd日", { locale: ja }) : "終了日を選択 (省略可)"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={recurringEndDate}
                                onSelect={setRecurringEndDate}
                                initialFocus
                                locale={ja}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}
                  </div>
                  
                    <DialogFooter className={cn(isMobile && "flex-col gap-2")}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetForm();
                        setIsAddDialogOpen(false);
                      }}
                    >
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={createGoal.isPending}>
                      {createGoal.isPending ? "追加中..." : "タスクを追加"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {!isLoading && filteredGoals.length > 0 && (
          <CardDescription className="mt-2">
            <div className="w-full bg-muted rounded-full h-2 mb-2 overflow-hidden">
              <Progress value={completionRate} className="h-full" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedGoals.length} 完了</span>
              <span>{totalTasks} 合計</span>
            </div>
          </CardDescription>
        )}
      </CardHeader>
      
      {/* Task filters section */}
      <div className="px-4 pt-2 pb-1 flex flex-col sm:flex-row gap-2 items-start sm:items-center border-b border-border/40">
        <div className="relative w-full sm:w-auto flex-1 sm:max-w-xs">
          <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="タスクを検索..."
            className="pl-8 pr-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            ref={searchInputRef}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-9 w-9 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
      <div className="flex gap-2 w-full overflow-x-auto pb-1 sm:w-auto sm:pb-0 scrollbar-hide">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 flex-shrink-0">
              <Filter className="h-4 w-4 mr-1" />
              フィルタ
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56 max-w-[90vw] max-h-[60vh] overflow-y-auto px-2"
              >
            <DropdownMenuLabel>フィルタを選択</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Priority filter */}
            <DropdownMenuLabel className="text-xs pt-2 font-normal text-muted-foreground">
              優先度
            </DropdownMenuLabel>
            <DropdownMenuItem
              className={!filterPriority ? "bg-accent/50" : ""}
              onClick={() => setFilterPriority(null)}
            >
              すべて
            </DropdownMenuItem>

            {priorityOptions.map((p) => (
              <DropdownMenuItem
                key={p.value}
                className={filterPriority === p.value ? "bg-accent/50" : ""}
                onClick={() => setFilterPriority(p.value)}
              >
                <div className="flex items-center gap-2">
                  <span className={`${p.bgColor} p-1 rounded-full`}>
                    {p.icon}
                  </span>
                  <span className={p.color}>{p.label}</span>
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Category filter */}
            <DropdownMenuLabel className="text-xs pt-2 font-normal text-muted-foreground">
              カテゴリ
            </DropdownMenuLabel>
            <DropdownMenuItem
              className={!filterCategory ? "bg-accent/50" : ""}
              onClick={() => setFilterCategory(null)}
            >
              すべて
            </DropdownMenuItem>

            {(uniqueCategories.length > 0
              ? uniqueCategories
              : defaultCategories.map((c) => c.id)
            ).map((c) => (
              <DropdownMenuItem
                key={c}
                className={filterCategory === c ? "bg-accent/50" : ""}
                onClick={() => setFilterCategory(c)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`${getCategoryColor(c)} w-3 h-3 rounded-full`}
                  ></span>
                  <span>{getCategoryName(c)}</span>
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Status filter */}
            <DropdownMenuLabel className="text-xs pt-2 font-normal text-muted-foreground">
              ステータス
            </DropdownMenuLabel>
            <DropdownMenuItem
              className={!filterStatus ? "bg-accent/50" : ""}
              onClick={() => setFilterStatus(null)}
            >
              すべて
            </DropdownMenuItem>

            <DropdownMenuItem
              className={filterStatus === "active" ? "bg-accent/50" : ""}
              onClick={() => setFilterStatus("active")}
            >
              未完了のみ
            </DropdownMenuItem>

            <DropdownMenuItem
              className={filterStatus === "completed" ? "bg-accent/50" : ""}
              onClick={() => setFilterStatus("completed")}
            >
              完了済みのみ
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Due date filter */}
            <DropdownMenuLabel className="text-xs pt-2 font-normal text-muted-foreground">
              期限日
            </DropdownMenuLabel>
            <DropdownMenuItem
              className={!filterDueDate ? "bg-accent/50" : ""}
              onClick={() => setFilterDueDate(null)}
            >
              すべて
            </DropdownMenuItem>

            <DropdownMenuItem
              className={filterDueDate === "today" ? "bg-accent/50" : ""}
              onClick={() => setFilterDueDate("today")}
            >
              今日
            </DropdownMenuItem>

            <DropdownMenuItem
              className={filterDueDate === "tomorrow" ? "bg-accent/50" : ""}
              onClick={() => setFilterDueDate("tomorrow")}
            >
              明日
            </DropdownMenuItem>

            <DropdownMenuItem
              className={filterDueDate === "week" ? "bg-accent/50" : ""}
              onClick={() => setFilterDueDate("week")}
            >
              今週中
            </DropdownMenuItem>

            <DropdownMenuItem
              className={filterDueDate === "overdue" ? "bg-accent/50" : ""}
              onClick={() => setFilterDueDate("overdue")}
            >
              期限超過
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Applied filters badges */}
        {(filterPriority || filterCategory || filterStatus || filterDueDate || searchQuery) && (
          <Badge
            variant="outline"
            className="h-9 px-3 flex items-center gap-1 hover:bg-accent/30 transition-colors cursor-pointer flex-shrink-0"
            onClick={resetFilters}
          >
            <X className="h-3.5 w-3.5" />
            <span>フィルタをクリア</span>
          </Badge>
        )}
      </div>
      </div>


      
      <CardContent className="flex-grow overflow-hidden pb-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <div className="loading-spinner"></div>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
            <p>タスクが見つかりませんでした。</p>
            <p className="text-sm">
              {searchQuery || filterPriority || filterCategory || filterStatus || filterDueDate
                ? "検索条件を変更するか、フィルタをクリアしてみてください。"
                : "新しいタスクを追加して、進捗を追跡しましょう。"}
            </p>
            {(searchQuery || filterPriority || filterCategory || filterStatus || filterDueDate) && (
              <Button variant="outline" className="mt-4" onClick={resetFilters}>
                フィルタをクリア
              </Button>
            )}
          </div>
        ) : (
            <ScrollArea className="flex-1 overflow-y-auto max-h-[calc(100dvh-30rem)]">
            <div className="space-y-4">
              {/* Overdue tasks */}
              {overdueTasks.length > 0 && (
                <div className="mb-4">
                  <h3 className="flex items-center gap-1.5 font-medium mb-2 text-red-500">
                    <ArrowUpCircle className="h-4 w-4" />
                    <span>期限超過のタスク</span>
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {overdueTasks.map((goal) => (
                        <motion.div
                          key={`overdue-${goal.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-2 p-2 border-2 border-red-500/30 rounded-md group hover:bg-red-500/10 transition-colors bg-red-500/5"
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full border border-red-500/50 hover:bg-red-500 hover:text-white shrink-0 mt-0.5"
                            onClick={() => updateGoalStatus.mutate({ id: goal.id, completed: !goal.completed })}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          
                          <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium break-words line-clamp-2">{goal.title}</span>
                              
                              <div className="flex items-center gap-1 ml-2">
                                {/* Priority icon */}
                                <div className={`${getPriorityDetails(goal.priority || "medium").bgColor} p-0.5 rounded-full hidden sm:flex`}>
                                  {getPriorityDetails(goal.priority || "medium").icon}
                                </div>
                                
                                {/* Recurring icon */}
                                {goal.isRecurring && (
                                  <span className="text-blue-500 hidden sm:flex">
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Display description if available */}
                            {goal.description && goal.description !== goal.title && (
                              <p className="text-xs text-muted-foreground mt-1 break-words line-clamp-2">
                                {goal.description}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap gap-1 mt-2">
                              {/* Due date */}
                              {goal.dueDate && (
                                <span className="text-xs text-red-500 flex items-center max-w-full">
                                  <ArrowUpCircle className="h-3 w-3 inline mr-1 shrink-0" />
                                  <span className="truncate">
                                    {format(new Date(goal.dueDate), "yyyy年MM月dd日", { locale: ja })} (期限超過)
                                  </span>
                                </span>
                              )}
                              
                              {/* Category tag */}
                              {goal.category && (
                                <Badge variant="outline" className="text-xs h-5 px-1.5 truncate max-w-[150px]">
                                  <span className={`${getCategoryColor(goal.category)} w-2 h-2 rounded-full mr-1.5`}></span>
                                  <span className="truncate">{getCategoryName(goal.category)}</span>
                                </Badge>
                              )}
                              
                              {/* Priority badge for mobile */}
                              <Badge variant="outline" className={`sm:hidden text-xs h-5 px-1.5 ${getPriorityDetails(goal.priority || "medium").color}`}>
                                {getPriorityDetails(goal.priority || "medium").label}
                              </Badge>
                              
                              {/* Tags */}
                              {goal.tags && goal.tags.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {goal.tags.slice(0, 2).map((tag, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs h-5 px-1.5 truncate max-w-[100px]">
                                      #{tag}
                                    </Badge>
                                  ))}
                                  {goal.tags.length > 2 && (
                                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                                      +{goal.tags.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditTask(goal)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditTask(goal)}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  編集
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-500 focus:text-red-500"
                                  onClick={() => deleteGoal.mutate(goal.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  削除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              
              {/* Due soon tasks */}
              {dueSoonTasks.length > 0 && (
                <div className="mb-4">
                  <h3 className="flex items-center gap-1.5 font-medium mb-2 text-amber-500">
                    <Clock className="h-4 w-4" />
                    <span>期限間近のタスク</span>
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {dueSoonTasks.map((goal) => (
                        <motion.div
                          key={`soon-${goal.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-2 p-2 border-2 border-amber-500/30 rounded-md group hover:bg-amber-500/10 transition-colors bg-amber-500/5"
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full border border-amber-500/50 hover:bg-amber-500 hover:text-white shrink-0 mt-0.5"
                            onClick={() => updateGoalStatus.mutate({ id: goal.id, completed: !goal.completed })}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          
                          <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium break-words line-clamp-2">{goal.title}</span>
                              
                              <div className="flex items-center gap-1 ml-2">
                                {/* Priority icon */}
                                <div className={`${getPriorityDetails(goal.priority || "medium").bgColor} p-0.5 rounded-full hidden sm:flex`}>
                                  {getPriorityDetails(goal.priority || "medium").icon}
                                </div>
                                
                                {/* Recurring icon */}
                                {goal.isRecurring && (
                                  <span className="text-blue-500 hidden sm:flex">
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Display description if available */}
                            {goal.description && goal.description !== goal.title && (
                              <p className="text-xs text-muted-foreground mt-1 break-words line-clamp-2">
                                {goal.description}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap gap-1 mt-2">
                              {/* Due date */}
                              {goal.dueDate && (
                                <span className="text-xs text-amber-500 flex items-center max-w-full">
                                  <Clock className="h-3 w-3 inline mr-1 shrink-0" />
                                  <span className="truncate">
                                    {format(new Date(goal.dueDate), "yyyy年MM月dd日", { locale: ja })}
                                  </span>
                                </span>
                              )}
                              
                              {/* Category tag */}
                              {goal.category && (
                                <Badge variant="outline" className="text-xs h-5 px-1.5 truncate max-w-[150px]">
                                  <span className={`${getCategoryColor(goal.category)} w-2 h-2 rounded-full mr-1.5`}></span>
                                  <span className="truncate">{getCategoryName(goal.category)}</span>
                                </Badge>
                              )}
                              
                              {/* Priority badge for mobile */}
                              <Badge variant="outline" className={`sm:hidden text-xs h-5 px-1.5 ${getPriorityDetails(goal.priority || "medium").color}`}>
                                {getPriorityDetails(goal.priority || "medium").label}
                              </Badge>
                              
                              {/* Tags */}
                              {goal.tags && goal.tags.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {goal.tags.slice(0, 2).map((tag, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs h-5 px-1.5 truncate max-w-[100px]">
                                      #{tag}
                                    </Badge>
                                  ))}
                                  {goal.tags.length > 2 && (
                                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                                      +{goal.tags.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditTask(goal)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditTask(goal)}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  編集
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-500 focus:text-red-500"
                                  onClick={() => deleteGoal.mutate(goal.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  削除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              
              {/* Regular active tasks */}
              {regularActiveTasks.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-1.5 font-medium mb-2">
                    <Rocket className="h-4 w-4 text-blue-500" />
                    <span>進行中のタスク</span>
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {regularActiveTasks.map((goal) => (
                        <motion.div
                          key={goal.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-2 p-2 border border-blue-500/20 rounded-md group hover:bg-accent/50 transition-colors"
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full border border-input hover:bg-primary hover:text-primary-foreground shrink-0 mt-0.5"
                            onClick={() => updateGoalStatus.mutate({ id: goal.id, completed: !goal.completed })}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          
                          <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium break-words line-clamp-2">{goal.title}</span>
                              
                              <div className="flex items-center gap-1 ml-2">
                                {/* Priority icon */}
                                <div className={`${getPriorityDetails(goal.priority || "medium").bgColor} p-0.5 rounded-full hidden sm:flex`}>
                                  {getPriorityDetails(goal.priority || "medium").icon}
                                </div>
                                
                                {/* Recurring icon */}
                                {goal.isRecurring && (
                                  <span className="text-blue-500 hidden sm:flex">
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Display description if available */}
                            {goal.description && goal.description !== goal.title && (
                              <p className="text-xs text-muted-foreground mt-1 break-words line-clamp-2">
                                {goal.description}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap gap-1 mt-2">
                              {/* Due date */}
                              {goal.dueDate && (
                                <span className="text-xs text-muted-foreground flex items-center max-w-full">
                                  <Calendar className="h-3 w-3 inline mr-1 shrink-0" />
                                  <span className="truncate">
                                    {format(new Date(goal.dueDate), "yyyy年MM月dd日", { locale: ja })}
                                  </span>
                                </span>
                              )}
                              
                              {/* Category tag */}
                              {goal.category && (
                                <Badge variant="outline" className="text-xs h-5 px-1.5 truncate max-w-[150px]">
                                  <span className={`${getCategoryColor(goal.category)} w-2 h-2 rounded-full mr-1.5`}></span>
                                  <span className="truncate">{getCategoryName(goal.category)}</span>
                                </Badge>
                              )}
                              
                              {/* Priority badge for mobile */}
                              <Badge variant="outline" className={`sm:hidden text-xs h-5 px-1.5 ${getPriorityDetails(goal.priority || "medium").color}`}>
                                {getPriorityDetails(goal.priority || "medium").label}
                              </Badge>
                              
                              {/* Tags */}
                              {goal.tags && goal.tags.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {goal.tags.slice(0, 2).map((tag, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs h-5 px-1.5 truncate max-w-[100px]">
                                      #{tag}
                                    </Badge>
                                  ))}
                                  {goal.tags.length > 2 && (
                                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                                      +{goal.tags.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditTask(goal)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditTask(goal)}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  編集
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-500 focus:text-red-500"
                                  onClick={() => deleteGoal.mutate(goal.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  削除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              
              {/* Completed tasks */}
              {completedGoals.length > 0 && (
                <div className="mt-6">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="completed-tasks" className="border-none">
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <h3 className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <Check className="h-4 w-4" />
                          <span>完了済みのタスク</span>
                          <Badge variant="outline" className="ml-2 font-normal">
                            {completedGoals.length}
                          </Badge>
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pt-2">
                          <AnimatePresence>
                            {completedGoals.map((goal) => (
                              <motion.div
                                key={`completed-${goal.id}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-start gap-2 p-2 border border-border/40 rounded-md group hover:bg-accent/30 transition-colors bg-accent/10"
                              >
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground shrink-0 mt-0.5"
                                  onClick={() => updateGoalStatus.mutate({ id: goal.id, completed: !goal.completed })}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                
                                <div className="flex-1 flex flex-col min-w-0 opacity-70">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium break-words line-clamp-1 line-through">{goal.title}</span>
                                    
                                    <div className="flex items-center gap-1 ml-2">
                                      {/* Recurring icon */}
                                      {goal.isRecurring && (
                                        <span className="text-blue-500/60 hidden sm:flex">
                                          <RefreshCw className="h-3.5 w-3.5" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {/* Category tag */}
                                    {goal.category && (
                                      <Badge variant="outline" className="text-xs h-5 px-1.5 truncate max-w-[150px] opacity-70">
                                        <span className={`${getCategoryColor(goal.category)} w-2 h-2 rounded-full mr-1.5 opacity-70`}></span>
                                        <span className="truncate">{getCategoryName(goal.category)}</span>
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() => deleteGoal.mutate(goal.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      
      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>タスクを編集</DialogTitle>
            <DialogDescription>
              タスクの詳細を更新してください。
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitUpdateTask} className="space-y-4 mt-2">
            {/* Basic Task Info */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit-task-title">タイトル <span className="text-red-500">*</span></Label>
                <Input 
                  id="edit-task-title"
                  value={taskTitle} 
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="タスクのタイトルを入力" 
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="edit-task-description">詳細な説明</Label>
                <Textarea 
                  id="edit-task-description"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="タスクの詳細を入力"
                  className="min-h-[100px]"
                />
              </div>
            </div>
            
            {/* Task metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-task-priority">優先度</Label>
                <Select value={priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="優先度を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(option => (
                      <SelectItem 
                        key={option.value} 
                        value={option.value} 
                        className="flex items-center gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`${option.bgColor} p-1 rounded-full`}>
                            {option.icon}
                          </span>
                          <span className={option.color}>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-task-category">カテゴリ</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultCategories.map(option => (
                      <SelectItem 
                        key={option.id} 
                        value={option.id} 
                        className="flex items-center gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`${option.color} w-3 h-3 rounded-full`}></span>
                          <span>{option.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Due date and reminder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>期限日</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "yyyy年MM月dd日", { locale: ja }) : "期限日を選択"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                      locale={ja}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <div className="flex items-center justify-between h-6 mb-1">
                  <Label htmlFor="task-reminder">リマインダー</Label>
                  {reminderTime ? (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs" 
                      onClick={() => setReminderTime(undefined)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      クリア
                    </Button>
                  ) : (
                    // Invisible placeholder to reserve space
      <div className="w-[40px] h-[16px] invisible" aria-hidden="true">.</div>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-10 justify-start text-left font-normal", // <- Add h-10 or same height as other inputs
                        !reminderTime && "text-muted-foreground"
                      )}
                    >
                      <Bell className="mr-2 h-4 w-4" />
                      {reminderTime
                        ? format(reminderTime, "yyyy年MM月dd日 HH:mm", { locale: ja })
                        : "リマインダーを設定"}
                    </Button>
                  </PopoverTrigger>


                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-4 space-y-4">
                      {/* Calendar */}
                      <CalendarComponent
                        mode="single"
                        selected={reminderTime}
                        onSelect={(date) =>
                          setReminderTime(
                            date
                              ? new Date(date.setHours(
                                  reminderTime?.getHours() ?? new Date().getHours(),
                                  reminderTime?.getMinutes() ?? new Date().getMinutes()
                                ))
                              : undefined
                          )
                        }
                        initialFocus
                        locale={ja}
                      />

                      {/* Custom Time Picker */}
                      {reminderTime && (
            <div className="flex items-center justify-center space-x-2">
              {/* Hour */}
              <Select value={String(reminderTime.getHours())} onValueChange={(val) => {
                const newDate = new Date(reminderTime);
                newDate.setHours(Number(val));
                setReminderTime(newDate);
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="時" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {i.toString().padStart(2, "0")} 時
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-900 dark:text-gray-300">時</span>

              {/* Minute */}
              <Select
                value={String(reminderTime.getMinutes())}
                onValueChange={(val) => {
                  const newDate = new Date(reminderTime);
                  newDate.setMinutes(Number(val));
                  setReminderTime(newDate);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="分" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 60 }).map((_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {i.toString().padStart(2, "0")} 分
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-900 dark:text-gray-300">分</span>
            </div>

                      )}
                    </div>
                  </PopoverContent>
                </Popover>

              </div>
            </div>
            
            {/* Tags */}
            <div>
              <Label htmlFor="edit-task-tags">タグ</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="gap-1 pl-2">
                    {tag}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  id="edit-task-tags"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="新しいタグを入力"
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  追加
                </Button>
              </div>
            </div>
            
            {/* Recurring Options */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-recurring-task"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
                <Label htmlFor="edit-recurring-task">繰り返しタスク</Label>
              </div>
              
              {isRecurring && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-recurring-type">繰り返しの種類</Label>
                      <Select value={recurringType} onValueChange={handleRecurringTypeChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="繰り返しの種類を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {recurringOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-recurring-interval">
                        間隔
                        {recurringType === 'daily' && ' (日)'}
                        {recurringType === 'weekly' && ' (週)'}
                        {recurringType === 'monthly' && ' (月)'}
                        {recurringType === 'custom' && ' (日)'}
                      </Label>
                      <Input
                        id="edit-recurring-interval"
                        type="number"
                        min="1"
                        value={recurringInterval}
                        onChange={(e) => setRecurringInterval(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>繰り返し終了日</Label>

                      {recurringEndDate ? (
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs" 
                          onClick={() => setRecurringEndDate(undefined)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          クリア
                        </Button>
                      ) : (
                        // Invisible placeholder to reserve space
                        <div className="w-[40px] h-[30px] invisible" aria-hidden="true">
                          .
                        </div>
                      )}
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !recurringEndDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {recurringEndDate ? format(recurringEndDate, "yyyy年MM月dd日", { locale: ja }) : "終了日を選択 (省略可)"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={recurringEndDate}
                          onSelect={setRecurringEndDate}
                          initialFocus
                          locale={ja}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsEditDialogOpen(false);
                  setCurrentEditingGoal(null);
                }}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={updateGoalDetails.isPending}>
                {updateGoalDetails.isPending ? "更新中..." : "タスクを更新"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Import for MoreVertical icon
import { MoreVertical } from "lucide-react";