import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
import { FileText, Pencil, Trash2, Plus, Download, Send, MessageSquare, Brain, Bot, Eraser, AlertTriangle, Lightbulb, Wand2, SquareMinus, X } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Spotlight } from "./ui/spotlight";
import { Trio } from 'ldrs/react'
import 'ldrs/react/Trio.css'


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
    name: "ノート操作 📝",
    icon: <FileText className="h-4 w-4" />,
    prompts: [
      {
        text: "選択ノートを要約",
        message: "選択されているノートの内容を簡潔に要約してください",
        description: "選択中のノートの内容をまとめます",
      },
      {
        text: "ノート間の関連性を分析",
        message: "選択されているノート間の関連性や共通点を分析してください",
        description: "選択中のノート間のつながりを見つけます",
      },
      {
        text: "主要なポイントを抽出",
        message: "選択されているノートから重要なポイントを箇条書きで抽出してください",
        description: "重要なポイントのみを抽出します",
      },
      {
        text: "知識ギャップを特定",
        message: "これらのノートの内容を分析し、さらに深堀りすべき知識のギャップがあれば特定してください",
        description: "知識の欠けている部分を見つけます",
      },
      {
        text: "新規ノートの提案",
        message: "これらのノートの内容を基に、新たに作成すべきノートのトピックとその内容を提案してください",
        description: "新しいノートのトピックを提案します",
      },
    ]
  },
  {
    name: "学習支援 🧠",
    icon: <Brain className="h-4 w-4" />,
    prompts: [
      {
        text: "説明を詳しく",
        message: "これらのノートの内容をより詳しく説明してください。専門用語は平易な言葉で解説し、具体例も加えてください",
        description: "内容を詳しく解説します",
      },
      {
        text: "質問を生成",
        message: "これらのノートの内容を理解度を確認するための質問を10個生成してください",
        description: "内容の理解を深める質問を作成します",
      },
      {
        text: "類似概念を比較",
        message: "これらのノートに含まれる類似した概念を比較し、その違いを表形式で説明してください",
        description: "類似概念の違いを明確にします",
      },
      {
        text: "実践応用の例",
        message: "これらのノートの内容を実生活や仕事でどのように応用できるか、具体的な例を教えてください",
        description: "学んだ内容の実践応用例を提示します",
      },
    ]
  },
  {
    name: "出力形式 📊",
    icon: <MessageSquare className="h-4 w-4" />,
    prompts: [
      {
        text: "表形式で整理",
        message: "選択されているノートの内容を表形式で整理してください",
        description: "内容を表形式で整理します",
      },
      {
        text: "マインドマップ形式",
        message: "選択されているノートの内容をマインドマップ形式でテキストとして表現してください",
        description: "マインドマップ形式で視覚化します",
      },
      {
        text: "タイムライン形式",
        message: "選択されているノートの内容を時系列で整理してください",
        description: "時間軸に沿って整理します",
      },
      {
        text: "FAQ形式",
        message: "選択されているノートの内容をFAQ形式で整理してください",
        description: "質問と回答の形式で整理します",
      },
      {
        text: "会話形式で解説",
        message: "選択されているノートの内容を、先生と生徒の会話形式で解説してください",
        description: "会話形式で内容を解説します",
      },
    ]
  },
  {
    name: "高度機能 🚀",
    icon: <Wand2 className="h-4 w-4" />,
    prompts: [
      {
        text: "批判的分析",
        message: "これらのノートの内容に対して批判的視点から分析し、異なる見解や改善点があれば指摘してください",
        description: "批判的視点から分析します",
      },
      {
        text: "メタファー創出",
        message: "これらのノートの内容を理解しやすいメタファーや比喩を使って説明してください",
        description: "わかりやすい比喩で説明します",
      },
      {
        text: "逆説的アプローチ",
        message: "これらのノートの内容の逆を考え、その視点から新たな洞察を得られるか検討してください",
        description: "逆の視点から考察します",
      },
      {
        text: "未来予測",
        message: "これらのノートの内容から、将来の展開や進化の方向性を予測してください",
        description: "将来の可能性を予測します",
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

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "title">("updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [pinnedNotes, setPinnedNotes] = useState<number[]>([]);

  // Note selection state for the chat
  const [selectedNotes, setSelectedNotes] = useState<Note[]>([]);
  const [isNoteChatOpen, setIsNoteChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const [showEmotions, setShowEmotions] = useState(false);
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        title: "メモを削除しました",
        description: "メモは正常に削除されました。",
      });
    },
    onError: (error) => {
      toast({
        title: "メモの削除に失敗しました",
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
        createdAt: new Date(),
        chatId: -1,
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

  // State for managing delete confirmation modal
  const [noteToDelete, setNoteToDelete] = useState<number | null>(null);

  // Handle initiating the delete process - opens the confirmation modal 
  const handleInitiateDelete = (id: number) => {
    setNoteToDelete(id);
  };

  // Handle confirming the deletion
  const handleConfirmDelete = () => {
    if (noteToDelete !== null) {
      deleteNoteMutation.mutate(noteToDelete);
      setNoteToDelete(null); // Reset after confirming
    }
  };

  // Handle canceling the deletion
  const handleCancelDelete = () => {
    setNoteToDelete(null);
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
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth',
        });

      }
    }
  }, [notesChatMessages, optimisticMessages, sendNotesChatMessage.isPending, isNoteChatOpen]);

  // Handle the insertion of prompt text
  const handleEmotionSelect = (text: string) => {
    const textarea = inputRef.current;
    if (!textarea) {
      setChatInput(prev => prev + text);
      setShowEmotions(false);
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

      // Automatically adjust the textarea height
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
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
    // ].sort((a, b) => {
    //   // Sort by timestamp
    //   return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    // });
  ].sort((a, b) => {
    const aDate =
      a.createdAt instanceof Date
        ? a.createdAt
        : new Date(a.createdAt ?? 0);
    const bDate =
      b.createdAt instanceof Date
        ? b.createdAt
        : new Date(b.createdAt ?? 0);
    return aDate.getTime() - bDate.getTime();
  });

  // Filter and sort notes
  const filteredAndSortedNotes = useMemo(() => {
    // First filter by search query
    let result = notes.filter(note => {
      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    });

    // Then sort
    result = [...result].sort((a, b) => {
      if (sortBy === "title") {
        return sortDirection === "asc"
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      }
      else if (sortBy === "created") {
        return sortDirection === "asc"
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      else {
        // Default: sort by updated date
        return sortDirection === "asc"
          ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    // Move pinned notes to the top
    if (pinnedNotes.length > 0) {
      result = [
        ...result.filter(note => pinnedNotes.includes(note.id)),
        ...result.filter(note => !pinnedNotes.includes(note.id))
      ];
    }

    return result;
  }, [notes, searchQuery, sortBy, sortDirection, pinnedNotes]);

  // Toggle note pinning
  const toggleNotePinned = useCallback((noteId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedNotes(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  }, []);

  return (
    <div className="space-y-4 h-full flex flex-col pt-5 md:pt-0">
      <Spotlight />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h2 className="text-2xl sm:text-2xl font-bold flex items-center gap-2 text-noble-black-100">
          <FileText className="h-5 w-5 " />
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
            <Badge variant="outline" className="ml-1 bg-noble-black-200 text-noble-black-900 text-[10px] px-1 py-0.5 h-4 leading-none">AI</Badge>
            {selectedNotes.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedNotes.length}
              </Badge>
            )}
          </Button>
          <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1 bg-black text-noble-black-100">
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
                    className="w-full bg-black outline-none focus:outline-none text-noble-black-100 border border-noble-black-900"
                  />
                </div>
                <div className="grid gap-2">
                  <Textarea
                    id="content"
                    placeholder="ノートの内容"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="w-full min-h-[200px] bg-black outline-none focus:outline-none text-noble-black-100 border border-noble-black-900"
                  />
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button
                  onClick={() => setIsAddNoteOpen(false)}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleAddNote}
                  disabled={createNoteMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {createNoteMutation.isPending ? "Creating..." : "ノートを作成"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
        <div className="relative w-full sm:w-auto sm:flex-1">
          <Input
            placeholder="ノートを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 bg-black outline-none focus:outline-none active:outline-none text-noble-black-100 border border-noble-black-900"
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 rounded-md overflow-hidden p-1 bg-black">
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-7 px-2 "
              onClick={() => setViewMode("list")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              リスト
            </Button>
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="h-7 px-2 "
              onClick={() => setViewMode("grid")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              グリッド
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-md p-1 bg-black text-noble-black-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-7 px-2 text-sm bg-noble-black-900 text-noble-black-100">
                  {sortBy === 'updated' ? '更新日' : sortBy === 'created' ? '作成日' : 'タイトル'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-24 bg-noble-black-900 text-noble-black-100 border border-noble-black-500">
                <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy('updated')}>
                  更新日
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('created')} className="cursor-pointer">
                  作成日
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('title')} className="cursor-pointer">
                  タイトル
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
            >
              {sortDirection === "asc" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 5 5 12"></polyline>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="5 12 12 19 19 12"></polyline>
                </svg>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Separator className="bg-noble-black-800" />

      <Card className="p-0 flex-1 min-h-0 overflow-auto
                             bg-black text-noble-black-100 border-noble-black-900 border rounded-lg">
        {isLoading ? (
          <div className="p-4 text-center flex flex-col items-center justify-center h-full">

            <Trio
              size="40"
              speed="1.3"
              color="#f2f2f2"
            />
            <p>読み込み中 </p>
          </div>
        ) : isError ? (
          <div className="p-4 text-center text-red-500">Error loading notes</div>
        ) : filteredAndSortedNotes.length === 0 ? (
          <div className="p-8 text-center">
            {searchQuery ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-20">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
                <p className="text-lg font-medium">No matching notes</p>
                <p className="text-muted-foreground">
                  「<span className="font-medium text-noble-black-100">{searchQuery}</span>」に一致するメモは見つかりませんでした。
                  <br />
                  <button
                    className="text-noble-black-900 bg-noble-black-100 hover:underline mt-2"
                    onClick={() => setSearchQuery("")}
                  >
                    検索をクリア
                  </button>
                </p>
              </>
            ) : (
              <>
                <FileText className="h-10 w-10 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">まだメモがありません</p>
                <p className="text-muted-foreground">「メモを追加」ボタンをクリックして、最初のメモを作成しましょう。</p>
              </>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="w-full overflow-x-auto rounded-t-lg">
            <Table className="min-w-full table-auto border-noble-black-900 border rounded-t-lg">
              <TableHeader className="border-noble-black-900 border rounded-t-lg">
                <TableRow className="hover:bg-black">
                  <TableHead className=" border-noble-black-900 border">タイトル</TableHead>
                  <TableHead className=" hidden md:table-cell border-noble-black-900 border">日付</TableHead>
                  <TableHead className=" text-right border-noble-black-900 border">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="border-noble-black-900 border h-full overflow-y-auto">
                <AnimatePresence>
                  {filteredAndSortedNotes.map((note) => (
                    <motion.tr
                      key={note.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`cursor-pointer hover:bg-noble-black-900/50 transition-colors ${pinnedNotes.includes(note.id) ? 'bg-black' : ''
                        }`}
                      onClick={() => handleViewNote(note)}
                    >
                      <TableCell className="font-medium border-noble-black-900 border">
                        <div className="flex items-center gap-2">
                          {pinnedNotes.includes(note.id) ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                              <path d="m15 2-6 6 4 4-7 7 4 4 7-7 4 4 6-6-12-12Z"></path>
                            </svg>
                          ) : (
                            <FileText className="h-4 w-4 text-noble-black-900" />
                          )}
                          <span className="truncate ">{note.title}</span>
                          {note.content.length > 500 && (
                            <Badge variant="outline" className="text-xs font-normal">長文</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell border-noble-black-900 border">
                        <div className="flex flex-col">
                          <span className="text-xs text-noble-black-100">
                            {format(new Date(note.updatedAt), 'yyyy年MM月dd日')}
                          </span>
                          {/* Show time since creation if it's recent */}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(note.createdAt), '作成: yyyy年MM月dd日')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right border-noble-black-900 border">
                        <div className="flex justify-between md:justify-end gap-2 ">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="p-1" asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => toggleNotePinned(note.id, e)}
                                  className={`p-0 md:p-2 w-5 md:w-10 ${pinnedNotes.includes(note.id) ? "text-blue-500" : ""}`}
                                >
                                  {pinnedNotes.includes(note.id) ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="12" y1="17" x2="12" y2="22"></line>
                                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 16.24Z"></path>
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="m15 9-6 6"></path>
                                      <path d="m9 9 6 6"></path>
                                      <line x1="12" y1="17" x2="12" y2="22"></line>
                                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 16.24Z"></path>
                                    </svg>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {pinnedNotes.includes(note.id) ? "Unpin" : "Pin this note"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="p-1" asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNoteSelection(note, e);
                                  }}
                                  className={`${selectedNotes.some(n => n.id === note.id) ? "text-blue-400" : ""} p-0 md:p-2 w-5 md:w-10`}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {selectedNotes.some(n => n.id === note.id)
                                  ? "Remove from chat selection"
                                  : "Add to chat selection"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="p-1" asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExportNote(note);
                                  }}
                                  className="p-0 md:p-2 w-5 md:w-10"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Export as PDF
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="p-1" asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditNote(note);
                                  }}
                                  className="p-0 md:p-2 w-5 md:w-10"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                ノートを編集
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="p-1" asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInitiateDelete(note.id);
                                  }}
                                  className="p-0 md:p-2 w-5 md:w-10"

                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Delete Note
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        ) : (
          // Grid view
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredAndSortedNotes.map((note) => (
                  <motion.div
                    key={`grid-${note.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`relative border rounded-lg overflow-hidden cursor-pointer group ${pinnedNotes.includes(note.id) ? 'border-noble-black-800 bg-noble-black-800 p-2 ' : 'border-noble-black-900 bg-noble-black-900'
                      }`}
                    onClick={() => handleViewNote(note)}
                  >
                    {/* Pin badge */}
                    {pinnedNotes.includes(note.id) && (
                      <div className="w-fit rounded-full bg-noble-black-100 border border-noble-black-100 text-noble-black-900 px-2 py-0.5 text-xs flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m15 2-6 6 4 4-7 7 4 4 7-7 4 4 6-6-12-12Z"></path>
                        </svg>
                        <span>固定</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-black text-noble-black-100 rounded-lg backdrop-blur-sm p-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => toggleNotePinned(note.id, e)}
                      >
                        {pinnedNotes.includes(note.id) ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                            <line x1="12" y1="17" x2="12" y2="22"></line>
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 16.24Z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 9-6 6"></path>
                            <path d="m9 9 6 6"></path>
                            <line x1="12" y1="17" x2="12" y2="22"></line>
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 16.24Z"></path>
                          </svg>
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNoteSelection(note, e);
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditNote(note);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInitiateDelete(note.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <h3 className="font-medium truncate">{note.title}</h3>
                      </div>

                      <div className="text-sm text-muted-foreground line-clamp-3 mb-3">
                        {note.content}
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>{format(new Date(note.updatedAt), 'yyyy年MM月dd日')}</span>

                        {selectedNotes.some(n => n.id === note.id) && (
                          <Badge variant="outline" className="text-xs font-normal ml-1">選択中</Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </Card>

      {/* Edit note dialog */}
      <Dialog open={isEditNoteOpen} onOpenChange={setIsEditNoteOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              ノートを編集
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
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              onClick={() => setIsEditNoteOpen(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              キャンセル
            </Button>

            <Button
              onClick={handleUpdateNote}
              disabled={updateNoteMutation.isPending}
              className="w-full sm:w-auto"
            >
              {updateNoteMutation.isPending ? (
                <span className="hidden sm:inline">更新中...</span>
              ) : (
                <>
                  <span className="hidden sm:inline">ノートを更新</span>
                  <span className="sm:hidden">更新</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation Dialog */}
      <AlertDialog open={noteToDelete !== null} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent className="mx-auto max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>ノートを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は元に戻せません。このノートは永久に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <div className="text-xs text-muted-foreground">
                  {currentNote && format(new Date(currentNote.updatedAt), 'yyyy年MM月dd日')}
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => currentNote && handleExportNote(currentNote)}
                  title="PDFとしてエクスポート"
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
          <DialogFooter className="pt-2 flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <Button
              onClick={() => setIsViewNoteOpen(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <span className="hidden sm:inline">閉じる</span>
              <span className="sm:hidden">閉じる</span>
            </Button>

            <Button
              onClick={() => {
                setIsViewNoteOpen(false);
                if (currentNote) {
                  handleEditNote(currentNote);
                }
              }}
              className="w-full sm:w-auto"
            >
              <Pencil className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">ノートを編集</span>
              <span className="sm:hidden">編集</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Chat Dialog */}
      <Dialog open={isNoteChatOpen} onOpenChange={setIsNoteChatOpen}>
        <DialogContent className="sm:pr-8 sm:max-w-[700px] max-h-[90vh] h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-4 py-2 border-b flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row justify-between gap-2">

              {/* Left Section */}
              <DialogTitle className="flex items-center">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-500" />
                  <span className="text-lg whitespace-nowrap">ノートアシスタント</span>

                  {/* Responsive flex container for badges */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 ml-1">
                    <Badge variant="outline" className="bg-blue-500/10 text-xs py-0 whitespace-nowrap">
                      ミライAI
                    </Badge>

                    {selectedNotes && selectedNotes.length > 0 && (
                      <Badge
                        variant="outline"
                        className="ml-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] px-3 py-1 rounded-full text-xs flex items-center justify-center"
                      >
                        {selectedNotes.length}件のノートを選択中
                      </Badge>
                    )}


                  </div>

                </div>
              </DialogTitle>




              {/* Right Section */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNotes([])}
                  disabled={selectedNotes.length === 0}
                  className="text-xs flex items-center gap-1"
                >
                  <SquareMinus className="h-3.5 w-3.5" />
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
                      <Trash2 className="h-3.5 w-3.5" />
                      履歴削除
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent className="mx-auto max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl p-6">

                    <AlertDialogHeader>
                      <AlertDialogTitle>チャット履歴を削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        この操作は取り消せません。本当に削除しますか？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          clearChatHistoryMutation.mutate();
                        }}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                      >
                        削除する
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>

                </AlertDialog>

              </div>
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
                      className={`flex items-center p-2 text-sm rounded cursor-pointer ${selectedNotes.some(n => n.id === note.id)
                        ? 'bg-blue-900/30 border border-blue-400/30'
                        : 'hover:bg-muted'
                        }`}
                      onClick={() => toggleNoteSelection(note, { stopPropagation: () => { } } as any)}
                    >
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{note.title}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(note.updatedAt), 'MM月dd日')}</div>
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
                        className={`flex-shrink-0 p-2 text-sm rounded cursor-pointer ${selectedNotes.some(n => n.id === note.id)
                          ? 'bg-blue-900/30 border border-blue-400/30'
                          : 'border border-muted hover:bg-muted'
                          }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleNoteSelection(note, { stopPropagation: () => { } } as any);
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
                    {allChatMessages.map((message, idx) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isFirstInGroup={idx === 0}
                        isLastInGroup={idx === allChatMessages.length - 1}
                        isPlayingAudio={false}
                        playingMessageId={null}
                        onPlayAudio={() => { }}
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
                    <Textarea
                      ref={inputRef}
                      value={chatInput}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setChatInput(e.target.value)}
                      placeholder="ノートについて質問してください..."
                      className="w-full pr-8 min-h-[40px] max-h-[200px] resize-none"
                      rows={1}
                      disabled={sendNotesChatMessage.isPending}
                      onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                          e.preventDefault();
                          handleChatSubmit(e);
                        }
                        // Automatically adjust the textarea height
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                      }}
                    />
                    <TooltipProvider key="prompt-tooltip">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            className="absolute right-2 top-2 text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent/50"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => setShowEmotions(prev => !prev)}
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