import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Goal } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Check, Plus, Target, Trash2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          <span>目標トラッカー</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <div className="loading-spinner"></div>
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
            <p>まだ目標が設定されていません。</p>
            <p className="text-sm">新しい目標を追加して、進捗を追跡しましょう。</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {activeGoals.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">進行中の目標</h3>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {activeGoals.map((goal) => (
                        <motion.div
                          key={goal.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 p-2 border rounded-md group hover:bg-accent/50 transition-colors"
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
              
              {completedGoals.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2 text-muted-foreground">達成済みの目標</h3>
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
                            className="h-6 w-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/80"
                            onClick={() => handleToggleGoal(goal.id, goal.completed)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <div className="flex-1 flex flex-col">
                            <span className="text-sm line-through text-muted-foreground">{goal.description}</span>
                            {goal.dueDate && (
                              <span className="text-xs text-muted-foreground/60 mt-1 flex items-center line-through">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {format(new Date(goal.dueDate), "yyyy年MM月dd日")}
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
      <CardFooter>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
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
                        {dueDate ? format(dueDate, "yyyy年MM月dd日") : "期限日を選択"}
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button 
                  type="submit" 
                  disabled={!newGoalDescription.trim() || createGoal.isPending}
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