import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Note, Message } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FileText, Pencil, Trash2, Plus, Download, Send, MessageSquare, Brain, Bot, Eraser, AlertTriangle, Lightbulb, Wand2 } from "lucide-react";
import { exportChatToPDF } from "@/lib/pdf-utils";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ChatMessage from "@/components/chat-message";
import { ChatLoadingIndicator } from "@/components/chat-loading-indicator";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { v4 as uuidv4 } from 'uuid';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Array of prompts that users can quickly select
interface Prompt {
  text: string;
  message?: string;
  description: string;
}

// Prompt categories to organize the prompts
interface PromptCategory {
  name: string;
  icon: JSX.Element;
  prompts: Prompt[];
}

const promptCategories: PromptCategory[] = [
  {
    name: "出力形式 📄",
    icon: <MessageSquare className="h-4 w-4" />,
    prompts: [
      {
        text: "会話形式で💬",
        message: "AさんとBさんの会話形式で出力して",
        description: "フレンドリーな会話形式で回答します",
      },
      {
        text: "箇条書き形式で📝",
        message: "箇条書き形式で出力して",
        description: "箇条書き形式で出力します",
      },
      {
        text: "表形式で📊",
        message: "表形式で出力して",
        description: "表形式で出力します",
      },
      {
        text: "FAQ形式で❓",
        message: "FAQ形式で出力して",
        description: "FAQ形式で出力します",
      },
      {
        text: "比喩・たとえ話形式🎭",
        message: "比喩・たとえ話形式で出力して",
        description: "比喩・たとえ話形式で出力します",
      },
      {
        text: "簡潔に要約✨",
        message: "簡潔に要約で出力して",
        description: "簡潔に要約で出力します",
      },
    ]
  },
  {
    name: "アシスタント 🤖",
    icon: <Wand2 className="h-4 w-4" />,
    prompts: [
      {
        text: "＋指示のコツ🎯",
        message: "質問に対してさらに理解を深めるために、どのような指示をすればよいか提案して",
        description: "より良い指示の出し方をアドバイスします",
      },
      {
        text: "「外部情報なし」🚫",
        message: "インターネットからの情報を利用しないで",
        description: "外部情報を使わずに回答します",
      },
      {
        text: "初心者向け📘",
        message: "説明に出てくる専門用語には、それぞれ説明を加え、初心者でも理解しやすいように。具体的な例を挙げながら丁寧に解説して",
        description: "具体的な例を挙げながら丁寧に解説します",
      },
    ]
  },
];

// Component for selecting emotion/prompt buttons
interface EmotionButtonsProps {
  onSelect: (message: string) => void;
  onClose: () => void;
}

const EmotionButtons = ({ onSelect, onClose }: EmotionButtonsProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(promptCategories[0].name);

  // Handle clicks outside the emotion buttons to close it
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedCategoryData = promptCategories.find(cat => cat.name === selectedCategory) || promptCategories[0];

  return (
    <motion.div
      ref={containerRef}
      className="bg-card shadow-lg rounded-xl border overflow-hidden w-full max-w-md"
      initial={{ y: 20, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {/* Category selector */}
      <div className="flex gap-1 p-2 bg-muted/40 overflow-x-auto scrollbar-hide">
        {promptCategories.map((category) => (
          <Button
            key={category.name}
            type="button"
            variant={selectedCategory === category.name ? "default" : "ghost"}
            size="sm"
            className="whitespace-nowrap text-xs flex items-center gap-1.5"
            onClick={() => setSelectedCategory(category.name)}
          >
            {category.icon}
            <span>{category.name}</span>
          </Button>
        ))}
      </div>

      {/* Prompt buttons */}
      <div className="grid grid-cols-1 gap-1 p-2 max-h-60 overflow-y-auto">
        {selectedCategoryData.prompts.map((prompt, index) => (
          <motion.button
            type="button" // Prevents default submit behavior
            key={index}
            className="flex flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              onSelect(prompt.message || prompt.text);
              onClose();
            }}
          >
            <span className="font-medium text-sm">{prompt.text}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{prompt.description}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export function NotesList() {
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isEditNoteOpen, setIsEditNoteOpen] = useState(false);
  const [isViewNoteOpen, setIsViewNoteOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Note selection state for the chat
  const [selectedNotes, setSelectedNotes] = useState<Note[]>([]);
  const [isNoteChatOpen, setIsNoteChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const [showEmotions, setShowEmotions] = useState(false);
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch notes
  const { data: notes = [], isLoading, isError } = useQuery<Note[]>({
    queryKey: ['/api/notes'],
  });

  // Fetch notes chat messages directly from the dedicated endpoint
  const { data: notesChatMessages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['/api/notes-chat-messages'],
    enabled: !!user && isNoteChatOpen,
    // Keep the messages even after closing/reopening the chat window
    staleTime: Infinity,
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await apiRequest('POST', '/api/notes', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      setIsAddNoteOpen(false);
      setNewNoteTitle("");
      setNewNoteContent("");
      toast({
        title: "Note created",
        description: "Your note has been successfully created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating note",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async (data: { id: number; title: string; content: string }) => {
      const { id, ...noteData } = data;
      const response = await apiRequest('PUT', `/api/notes/${id}`, noteData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      setIsEditNoteOpen(false);
      setCurrentNote(null);
      toast({
        title: "Note updated",
        description: "Your note has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating note",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      toast({
        title: "Note deleted",
        description: "Your note has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting note",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Notes Chat mutation
  const sendNotesChatMessage = useMutation({
    mutationFn: async (content: string) => {
      // Create optimistic message
      const optimisticUserMessage = {
        id: uuidv4(),
        userId: user?.id || 0,
        content,
        isBot: false,
        timestamp: new Date(),
        sessionId: `notes_${user?.id}_${user?.username}`,
      };

      // Add optimistic message to local state
      setOptimisticMessages(prev => [...prev, optimisticUserMessage]);

      // Send the message to the server
      const response = await apiRequest('POST', '/api/notes-chat', {
        content,
        notes: selectedNotes,
      });

      return {
        botMessage: await response.json(),
        userContent: content,
        userMessageId: optimisticUserMessage.id
      };
    },
    onSuccess: (data) => {
      // Get the bot message from the response
      const newBotMessage = data.botMessage;

      // Remove the optimistic message with this ID
      const currentOptimisticMessages = optimisticMessages.filter(
        msg => msg.id !== data.userMessageId
      );
      setOptimisticMessages(currentOptimisticMessages);

      // Add the bot response to the query cache
      queryClient.setQueryData<Message[]>(['/api/notes-chat-messages'], (oldMessages = []) => {
        if (!oldMessages) return [newBotMessage];

        // Add the bot message to existing messages
        return [...oldMessages, newBotMessage];
      });

      // Invalidate the messages query to ensure we have the actual server data
      queryClient.invalidateQueries({ queryKey: ['/api/notes-chat-messages'] });
    },
    onError: (error) => {
      // Clear optimistic messages on error
      setOptimisticMessages([]);

      toast({
        title: "Error occurred",
        description: "Failed to send message. Please try again later.",
        variant: "destructive",
      });
    },
  });
  
  // Clear chat history mutation
  const clearChatHistoryMutation = useMutation({
    mutationFn: async () => {
      // Make DELETE request to the API endpoint
      await apiRequest('DELETE', '/api/notes-chat-messages');
    },
    onSuccess: () => {
      // Clear optimistic messages
      setOptimisticMessages([]);
      
      // Clear the query cache
      queryClient.setQueryData(['/api/notes-chat-messages'], []);
      
      // Invalidate the messages query to ensure it's updated
      queryClient.invalidateQueries({ queryKey: ['/api/notes-chat-messages'] });
      
      toast({
        title: "Chat history cleared",
        description: "Your notes chat history has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error clearing chat history",
        description: "Failed to clear chat history. Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleAddNote = () => {
    if (!newNoteTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your note.",
        variant: "destructive",
      });
      return;
    }

    createNoteMutation.mutate({
      title: newNoteTitle,
      content: newNoteContent,
    });
  };

  const handleUpdateNote = () => {
    if (!currentNote) return;

    if (!newNoteTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your note.",
        variant: "destructive",
      });
      return;
    }

    updateNoteMutation.mutate({
      id: currentNote.id,
      title: newNoteTitle,
      content: newNoteContent,
    });
  };

  const handleEditNote = (note: Note) => {
    setCurrentNote(note);
    setNewNoteTitle(note.title);
    setNewNoteContent(note.content);
    setIsEditNoteOpen(true);
  };

  const handleViewNote = (note: Note) => {
    setCurrentNote(note);
    setIsViewNoteOpen(true);
  };

  const handleDeleteNote = (id: number) => {
    if (confirm("Are you sure you want to delete this note?")) {
      deleteNoteMutation.mutate(id);
    }
  };

  const handleExportNote = async (note: Note) => {
    try {
      // Create messages-like structure for PDF export
      const messages = [
        {
          id: 1,
          userId: 1,
          content: `# ${note.title}\n\n${note.content}`,
          isBot: false,
          timestamp: note.createdAt,
          sessionId: "notes",
        }
      ];

      await exportChatToPDF(
        messages as any, 
        `note-${note.id}-${note.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        {
          title: note.title,
          includeTimestamp: true,
          theme: "light"
        }
      );

      toast({
        title: "Note exported",
        description: "Your note has been exported as PDF.",
      });
    } catch (error) {
      console.error("Error exporting note:", error);
      toast({
        title: "Export failed",
        description: "An error occurred while exporting the note.",
        variant: "destructive",
      });
    }
  };

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current && isNoteChatOpen) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [notesChatMessages, optimisticMessages, sendNotesChatMessage.isPending, isNoteChatOpen]);

  // Handle the insertion of prompt text
  const handleEmotionSelect = (text: string) => {
    const textarea = inputRef.current;
    if (!textarea) {
      setChatInput(prev => prev + text);
      return;
    }

    textarea.focus(); // Make sure it has focus before querying selection

    const start = textarea.selectionStart ?? chatInput.length;
    const end = textarea.selectionEnd ?? chatInput.length;

    const newValue = chatInput.slice(0, start) + text + chatInput.slice(end);
    setChatInput(newValue);

    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  };


  // Handle chat form submission
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    sendNotesChatMessage.mutate(chatInput);
    setChatInput("");

    // Focus back on the input field after sending
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Toggle note selection for chat
  const toggleNoteSelection = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent view note dialog from opening

    if (selectedNotes.some(n => n.id === note.id)) {
      setSelectedNotes(selectedNotes.filter(n => n.id !== note.id));
    } else {
      setSelectedNotes([...selectedNotes, note]);
    }
  };

  // All messages including optimistic ones
  const allChatMessages = [
    ...notesChatMessages,
    ...optimisticMessages
  ].sort((a, b) => {
    // Sort by timestamp
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                ノート
              </h2>
              <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1" 
            onClick={() => setIsNoteChatOpen(true)}
            disabled={notes.length === 0}
          >
            <Brain className="h-4 w-4" />
            <span>ノートとチャット</span>
            {selectedNotes.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedNotes.length}
              </Badge>
            )}
          </Button>
          <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                <span>ノートを追加</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  新しいノートを作成
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Input
                    id="title"
                    placeholder="ノートのタイトル"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="grid gap-2">
                  <Textarea
                    id="content"
                    placeholder="ノートの内容"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="w-full min-h-[200px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => setIsAddNoteOpen(false)}
                  variant="outline"
                >
                  キャンセル
                </Button>
                <Button 
                  onClick={handleAddNote}
                  disabled={createNoteMutation.isPending}
                >
                  {createNoteMutation.isPending ? "Creating..." : "ノートを作成"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      <Card className="p-0">
        {isLoading ? (
          <div className="p-4 text-center">Loading notes...</div>
        ) : isError ? (
          <div className="p-4 text-center text-red-500">Error loading notes</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No notes yet</p>
            <p className="text-muted-foreground">Create your first note by clicking the Add Note button.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[130px]">タイトル</TableHead>
                <TableHead className="min-w-[120px]">作成日</TableHead>
                <TableHead className="min-w-[120px]">更新日</TableHead>
                <TableHead className="min-w-[100px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {notes.map((note) => (
                  <motion.tr
                    key={note.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewNote(note)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        {note.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(note.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportNote(note);
                          }}
                          title="Export as PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditNote(note);
                          }}
                          title="Edit Note"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                          title="Delete Note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Edit note dialog */}
      <Dialog open={isEditNoteOpen} onOpenChange={setIsEditNoteOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Note
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Input
                id="edit-title"
                placeholder="ノートのタイトル"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Textarea
                id="edit-content"
                placeholder="ノートの内容"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="w-full min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Markdown formatting is preserved
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsEditNoteOpen(false)}
              variant="outline"
            >
              キャンセル
            </Button>
            <Button 
              onClick={handleUpdateNote}
              disabled={updateNoteMutation.isPending}
            >
              {updateNoteMutation.isPending ? "Updating..." : "Update Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View note dialog */}
      <Dialog open={isViewNoteOpen} onOpenChange={setIsViewNoteOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {currentNote?.title}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {currentNote && format(new Date(currentNote.updatedAt), 'MMM d, yyyy')}
                </Badge>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => currentNote && handleExportNote(currentNote)}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-auto">
            <div className="py-4 px-1 prose prose-sm prose-invert max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ node, ...props }) => (
                    <table className="border-collapse border border-gray-700 w-full my-4" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-gray-700 bg-gray-800 px-4 py-2 text-left" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-gray-700 px-4 py-2" {...props} />
                  ),
                  a: ({ node, ...props }) => (
                    <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
                  )
                }}
              >
                {currentNote?.content || ""}
              </ReactMarkdown>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-2">
            <Button
              onClick={() => setIsViewNoteOpen(false)}
              variant="outline"
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                setIsViewNoteOpen(false);
                if (currentNote) {
                  handleEditNote(currentNote);
                }
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Chat Dialog */}
          <Dialog open={isNoteChatOpen} onOpenChange={setIsNoteChatOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] h-[80vh] overflow-hidden flex flex-col p-0">
              <DialogHeader className="px-4 py-2 border-b flex items-center justify-between">
                <DialogTitle>
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-blue-500" />
                    <span>ノートアシスタント</span>
                    {selectedNotes.length > 0 && (
                      <Badge variant="outline" className="ml-1">
                        {selectedNotes.length}件のノートを選択中
                      </Badge>
                    )}
                  </div>
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedNotes([])}
                    disabled={selectedNotes.length === 0}
                    className="text-xs"
                  >
                    選択を解除
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs flex items-center gap-1"
                        disabled={!notesChatMessages.length && !optimisticMessages.length}
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        履歴削除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          チャット履歴を削除しますか？
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          この操作は元に戻せません。すべての会話履歴がデータベースから完全に削除されます。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => clearChatHistoryMutation.mutate()}
                          className="bg-destructive hover:bg-destructive/90"
                          disabled={clearChatHistoryMutation.isPending}
                        >
                          {clearChatHistoryMutation.isPending ? "削除中..." : "削除する"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  {/* Default close button provided by the Dialog library */}
                </div>
              </DialogHeader>


          <div className="flex flex-1 overflow-hidden">
            {/* Notes selection sidebar - Desktop */}
            <div className="w-[200px] border-r p-2 hidden sm:block">
              <h3 className="text-sm font-medium mb-2">ノートを選択</h3>
              <ScrollArea className="h-[calc(80vh-4rem)]">
                <div className="space-y-1 pr-2">
                  {notes.map((note) => (
                    <div
                      key={`select-${note.id}`}
                      className={`flex items-center p-2 text-sm rounded cursor-pointer ${
                        selectedNotes.some(n => n.id === note.id)
                          ? 'bg-blue-900/30 border border-blue-400/30'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleNoteSelection(note, { stopPropagation: () => {} } as any)}
                    >
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{note.title}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(note.updatedAt), 'MMM d')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile notes selection */}
              <div className="sm:hidden border-b mb-2">
                <ScrollArea className="py-2">
                  <div className="flex gap-2 px-2 overflow-x-auto pb-2">
                    {notes.map((note) => (
                      <div
                        key={`mobile-select-${note.id}`}
                        className={`flex-shrink-0 p-2 text-sm rounded cursor-pointer ${
                          selectedNotes.some(n => n.id === note.id)
                            ? 'bg-blue-900/30 border border-blue-400/30'
                            : 'border border-muted hover:bg-muted'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleNoteSelection(note, { stopPropagation: () => {} } as any);
                        }}
                      >
                        <div className="flex-1 whitespace-nowrap">
                          <div className="font-medium">{note.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <ChatLoadingIndicator message="Loading conversation history..." />
                  </div>
                ) : allChatMessages.length === 0 ? (
                  <div className="flex flex-col h-full items-center justify-center text-center text-muted-foreground p-4">
                    <img
                src="/images/mirai.png"
                alt="Chat Icon"
                className="h-20 w-20 mb-4 opacity-80"
              />
                    <h3 className="text-lg font-medium">自分のノートとチャットする</h3>
                    <p className="max-w-sm">
                      {notes.length > 0 ? (
                        selectedNotes.length > 0 ? (
                          "選択したノートについて質問してください。"
                        ) : (
                          isMobile ? 
                          "上でノートを選択するか、すべてのノートについて質問してください。" :
                          "サイドバーからノートを選択するか、すべてのノートについて質問してください。"
                        )
                      ) : (
                        "チャットするには、まずノートを作成してください。"
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allChatMessages.map((message) => (
                      <ChatMessage 
                        key={message.id} 
                        message={message}
                      />
                    ))}
                    {sendNotesChatMessage.isPending && (
                      <ChatLoadingIndicator variant="minimal" />
                    )}
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t">
                <form onSubmit={handleChatSubmit} className="flex gap-2 relative">
                  <AnimatePresence>
                    {showEmotions && (
                      <div className="absolute bottom-full left-0 w-full flex justify-center">
                        <EmotionButtons onSelect={handleEmotionSelect} onClose={() => setShowEmotions(false)} />
                      </div>
                    )}
                  </AnimatePresence>

                  <div className="relative w-full">
                    <Input
                      ref={inputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="ノートについて質問してください..."
                      className="w-full pr-8"
                      disabled={sendNotesChatMessage.isPending}
                    />
                    <TooltipProvider key="prompt-tooltip">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            className="absolute right-2 top-2 text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent/50"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowEmotions((prev) => !prev)}
                          >
                            <Lightbulb className="h-4 w-4" />
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>プロンプト一覧</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <Button 
                    type="submit" 
                    size="icon"
                    disabled={!chatInput.trim() || sendNotesChatMessage.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                {notes.length > 0 && selectedNotes.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">ノートが選択されていません。アシスタントはすべてのノートを使用します。</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}