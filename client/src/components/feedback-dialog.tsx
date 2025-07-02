import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);

  // Get session ID from local storage
  const getSessionId = () => {
    if (!user?.id) return "";
    const storageKey = `chat_session_id_user_${user.id}`;
    return localStorage.getItem(storageKey) || "";
  };

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("ユーザー情報が見つかりません。");
      }
      
      const sessionId = getSessionId();
      if (!sessionId) {
        throw new Error("セッションIDが見つかりません。");
      }
      
      // Note: messageId is optional in this implementation
      const payload = {
        comment,
        rating,
        sessionId,
      };

      const res = await apiRequest("POST", `/api/feedback`, payload);
      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`Failed to submit feedback: ${res.status} ${errorText}`);
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "フィードバック送信完了",
        description: "フィードバックをお送りいただきありがとうございます。",
        duration: 3000,
      });
      
      // Reset the form and close the dialog
      setComment("");
      setRating(null);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "送信エラー",
        description: error instanceof Error ? error.message : "フィードバックの送信に失敗しました。",
        variant: "destructive",
        duration: 4000,
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    feedbackMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-auto max-w-[95%] border border-blue-900/50 bg-slate-950/90 backdrop-blur-lg shadow-md p-6 rounded-xl ">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">フィードバックをお聞かせください</DialogTitle>
          <DialogDescription className="text-white">
            サービス向上のため、ご意見・ご感想をお聞かせください。
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Rating Stars */}
          <div className="space-y-2">
            <Label htmlFor="rating" className="text-violet-500">評価</Label>
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`hover:bg-violet-500 p-1 ${rating && rating >= value ? "text-violet-400" : "text-white"}`}
                  onClick={() => setRating(value)}
                >
                  <Star className="h-6 w-6" fill={rating && rating >= value ? "currentColor" : "none"} />
                </Button>
              ))}
            </div>
          </div>
          
          {/* Comment Textarea */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-violet-500">コメント</Label>
            <Textarea
              id="comment"
              placeholder="ご意見・ご感想をお聞かせください..."
              className="min-h-[100px] border-blue-900/50 bg-slate-950 focus:border-violet-900/50 focus:ring-blue-900/50"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="mt-4 border-blue-900/50 bg-slate-950 font-medium rounded-xl shadow-md "
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={feedbackMutation.isPending || (!comment && rating === null)}
              className="mt-4 bg-gradient-to-r from-violet-400 to-violet-500 hover:from-violet-500 hover:to-violet-600 text-violet-900 hover:text-white font-medium rounded-xl shadow-md "
            >
              送信
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}