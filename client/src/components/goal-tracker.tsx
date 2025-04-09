import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Goal } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Check, Plus, Target, Trash2, Calendar, Rocket, Award, Clock, TrendingUp, Zap, ArrowUpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays, isBefore } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ja } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";


export function GoalTracker() {
  const [newGoalDescription, setNewGoalDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch goals
  const { data: goals = [], isLoading, error } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
    refetchOnWindowFocus: true,
  });

  // Create goal mutation
  const createGoal = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        '/api/goals',
        { 
          description: newGoalDescription.trim(), 
          completed: false,
          dueDate: dueDate
        }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      setNewGoalDescription("");
      setDueDate(undefined);
      setIsAddDialogOpen(false);
      toast({
        title: "目標を追加しました",
        description: "新しい目標が追加されました。",
      });
    },
    onError: (error) => {
      console.error("Error creating goal:", error);
      toast({
        title: "エラーが発生しました",
        description: "目標の追加に失敗しました。もう一度お試しください。",
        variant: "destructive"
      });
    }
  });

  // Update goal mutation
  const updateGoal = useMutation({
    mutationFn: async ({ id, completed }: { id: number, completed: boolean }) => {
      const goal = goals.find(g => g.id === id);
      if (!goal) throw new Error("Goal not found");

      const response = await apiRequest(
        'PUT',
        `/api/goals/${id}`,
        { 
          description: goal.description, 
          completed,
          dueDate: goal.dueDate
        }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
    },
    onError: (error) => {
      console.error("Error updating goal:", error);
      toast({
        title: "エラーが発生しました",
        description: "目標の更新に失敗しました。もう一度お試しください。",
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
        title: "目標を削除しました",
        description: "目標が削除されました。",
      });
    },
    onError: (error) => {
      console.error("Error deleting goal:", error);
      toast({
        title: "エラーが発生しました",
        description: "目標の削除に失敗しました。もう一度お試しください。",
        variant: "destructive"
      });
    }
  });

  const handleSubmitGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalDescription.trim()) return;
    createGoal.mutate();
  };

  const handleToggleGoal = (id: number, currentStatus: boolean) => {
    updateGoal.mutate({ id, completed: !currentStatus });
  };

  const handleDeleteGoal = (id: number) => {
    deleteGoal.mutate(id);
  };

  const activeGoals = goals.filter(goal => !goal.completed);
  const completedGoals = goals.filter(goal => goal.completed);

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded-md">
        目標の読み込み中にエラーが発生しました。
      </div>
    );
  }

  // Calculate goal stats
  const totalGoals = goals.length;
  const completionRate = totalGoals > 0 ? Math.round((completedGoals.length / totalGoals) * 100) : 0;
  
  // Get due soon goals (within next 3 days)
  const today = new Date();
  const dueSoonGoals = activeGoals.filter(goal => {
    if (!goal.dueDate) return false;
    const dueDate = new Date(goal.dueDate);
    const daysUntilDue = differenceInDays(dueDate, today);
    return daysUntilDue >= 0 && daysUntilDue <= 3;
  });

  // Get overdue goals
  const overdueGoals = activeGoals.filter(goal => {
    if (!goal.dueDate) return false;
    const dueDate = new Date(goal.dueDate);
    return isBefore(dueDate, today) && !goal.completed;
  });
  
  // Get whether a goal is due soon or overdue
  const getGoalStatus = (goal: Goal) => {
    if (!goal.dueDate) return null;
    const dueDate = new Date(goal.dueDate);
    const today = new Date();
    
    if (isBefore(dueDate, today)) {
      return "overdue";
    }
    
    const daysUntilDue = differenceInDays(dueDate, today);
    if (daysUntilDue >= 0 && daysUntilDue <= 3) {
      return "soon";
    }
    
    return null;
  };

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
            <CardTitle className="text-base sm:text-lg">目標トラッカー</CardTitle>
          </div>
          
          <div className="flex items-center gap-2 mt-1 sm:mt-0">
            {!isLoading && goals.length > 0 && (
              <Badge variant="outline" className="flex items-center gap-1 bg-blue-500/10 h-6">
                <Award className="h-3 w-3 text-blue-400" />
                <span className="text-xs">{completionRate}% 達成</span>
              </Badge>
            )}
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline" 
                  className="h-6 px-2 text-xs gap-1 sm:hidden"
                >
                  <Plus className="h-3 w-3" />
                  <span>新規</span>
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
        
        {!isLoading && goals.length > 0 && (
          <CardDescription className="mt-2">
            <div className="w-full bg-muted rounded-full h-2 mb-2 overflow-hidden">
              <Progress value={completionRate} className="h-full" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedGoals.length} 完了</span>
              <span>{totalGoals} 合計</span>
            </div>
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="flex-grow overflow-hidden pb-1 flex flex-col min-h-[70vh] sm:min-h-[65vh] md:min-h-0">
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <div className="loading-spinner"></div>
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
            <p>まだ目標が設定されていません。</p>
            <p className="text-sm">新しい目標を追加して、進捗を追跡しましょう。</p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-4 min-h-[calc(100%-20px)] flex-grow flex-1">
            <div className="space-y-4">
              {/* Due soon goals highlighted section */}
              {dueSoonGoals.length > 0 && (
                <div className="mb-4">
                  <h3 className="flex items-center gap-1.5 font-medium mb-2 text-amber-500">
                    <Clock className="h-4 w-4" />
                    <span>期限間近の目標</span>
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {dueSoonGoals.map((goal) => (
                        <motion.div
                          key={`soon-${goal.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 p-2 border-2 border-amber-500/30 rounded-md group hover:bg-amber-500/10 transition-colors bg-amber-500/5"
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full border border-amber-500/50 hover:bg-amber-500 hover:text-white"
                            onClick={() => handleToggleGoal(goal.id, goal.completed)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <div className="flex-1 flex flex-col">
                            <span className="text-sm font-medium">{goal.description}</span>
                            {goal.dueDate && (
                              <span className="text-xs text-amber-500 mt-1 flex items-center">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {format(new Date(goal.dueDate), "yyyy年MM月dd日", { locale: ja })}
                              </span>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              
              {/* Overdue goals highlighted section */}
              {overdueGoals.length > 0 && (
                <div className="mb-4">
                  <h3 className="flex items-center gap-1.5 font-medium mb-2 text-red-500">
                    <ArrowUpCircle className="h-4 w-4" />
                    <span>期限超過の目標</span>
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {overdueGoals.map((goal) => (
                        <motion.div
                          key={`overdue-${goal.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 p-2 border-2 border-red-500/30 rounded-md group hover:bg-red-500/10 transition-colors bg-red-500/5"
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full border border-red-500/50 hover:bg-red-500 hover:text-white"
                            onClick={() => handleToggleGoal(goal.id, goal.completed)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <div className="flex-1 flex flex-col">
                            <span className="text-sm font-medium">{goal.description}</span>
                            {goal.dueDate && (
                              <span className="text-xs text-red-500 mt-1 flex items-center">
                                <ArrowUpCircle className="h-3 w-3 inline mr-1" />
                                {format(new Date(goal.dueDate), "yyyy年MM月dd日", { locale: ja })} (期限超過)
                              </span>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              
              {/* Regular active goals */}
              {activeGoals.filter(goal => 
                getGoalStatus(goal) !== "soon" && getGoalStatus(goal) !== "overdue"
              ).length > 0 && (
                <div>
                  <h3 className="flex items-center gap-1.5 font-medium mb-2">
                    <Rocket className="h-4 w-4 text-blue-500" />
                    <span>進行中の目標</span>
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {activeGoals
                        .filter(goal => getGoalStatus(goal) !== "soon" && getGoalStatus(goal) !== "overdue")
                        .map((goal) => (
                        <motion.div
                          key={goal.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 p-2 border border-blue-500/20 rounded-md group hover:bg-accent/50 transition-colors"
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full border border-input hover:bg-primary hover:text-primary-foreground"
                            onClick={() => handleToggleGoal(goal.id, goal.completed)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <div className="flex-1 flex flex-col">
                            <span className="text-sm">{goal.description}</span>
                            {goal.dueDate && (
                              <span className="text-xs text-muted-foreground mt-1 flex items-center">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {format(new Date(goal.dueDate), "yyyy年MM月dd日", { locale: ja })}
                              </span>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              
              {/* Completed goals */}
              {completedGoals.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-1.5 font-medium mb-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span>達成済みの目標</span>
                  </h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {completedGoals.map((goal) => (
                        <motion.div
                          key={goal.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 p-2 border rounded-md group hover:bg-accent/50 transition-colors bg-muted/30"
                        >
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 rounded-full bg-green-500 text-white hover:bg-green-600"
                            onClick={() => handleToggleGoal(goal.id, goal.completed)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <div className="flex-1 flex flex-col">
                            <span className="text-sm line-through text-muted-foreground">{goal.description}</span>
                            {goal.dueDate && (
                              <span className="text-xs text-muted-foreground/60 mt-1 flex items-center line-through">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {format(new Date(goal.dueDate), "yyyy年MM月dd日", { locale: ja })}
                              </span>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      
      <CardFooter className="pt-2">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full hidden sm:flex" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              新しい目標を追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しい目標を追加</DialogTitle>
              <DialogDescription>
                達成したい目標を入力してください。
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitGoal}>
              <div className="py-4 space-y-4">
                <Input
                  placeholder="目標を入力..."
                  value={newGoalDescription}
                  onChange={(e) => setNewGoalDescription(e.target.value)}
                  className="w-full"
                />
                
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="due-date" className="text-sm font-medium">
                    期限日 (オプション)
                  </label>
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
              </div>
              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  キャンセル
                </Button>
                <Button 
                  type="submit" 
                  disabled={!newGoalDescription.trim() || createGoal.isPending}
                  className="w-full sm:w-auto"
                >
                  {createGoal.isPending ? "追加中..." : "追加"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}