import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Book, Save } from "lucide-react";
import { Message } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SaveChatAsNoteProps {
  message: Message;
}

export function SaveChatAsNote({ message }: SaveChatAsNoteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const { toast } = useToast();

  // ノートを作成 mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await apiRequest('POST', '/api/notes', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      setIsOpen(false);
      toast({
        title: "Message saved as note",
        description: "The message has been saved as a note.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving note",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSaveAsNote = () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your note.",
        variant: "destructive",
      });
      return;
    }

    createNoteMutation.mutate({
      title,
      content,
    });
  };

  const handleOpen = (isOpen: boolean) => {
    setIsOpen(isOpen);
    if (isOpen) {
      setTitle(message.isBot ? "AIの応答" : "私のメッセージ");
      setContent(message.content);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-[9px] sm:text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity h-5 px-1.5 py-0"
        >
          <Book className="h-3 w-3" />
          <span className="hidden sm:inline">Save as Note</span>
          <span className="sm:hidden">Save</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save as Note
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Input
              id="title"
              placeholder="ノートのタイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="grid gap-2">
            <Textarea
              id="content"
              placeholder="ノートの内容"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Markdown formatting is preserved when saving notes
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => setIsOpen(false)}
            variant="outline"
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleSaveAsNote}
            disabled={createNoteMutation.isPending}
          >
            {createNoteMutation.isPending ? "Saving..." : "Save Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}