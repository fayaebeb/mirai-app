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
import { FileText, Pencil, Trash2, Plus, Download, Send, MessageSquare, Brain, Bot } from "lucide-react";
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
                  Create New Note
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Input
                    id="title"
                    placeholder="Note Title"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="grid gap-2">
                  <Textarea
                    id="content"
                    placeholder="Note Content"
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
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddNote}
                  disabled={createNoteMutation.isPending}
                >
                  {createNoteMutation.isPending ? "Creating..." : "Create Note"}
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
                <TableHead className="w-[300px]">タイトル</TableHead>
                <TableHead>作成日</TableHead>
                <TableHead>更新日</TableHead>
                <TableHead className="text-right">操作</TableHead>
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
                placeholder="Note Title"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Textarea
                id="edit-content"
                placeholder="Note Content"
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
              Cancel
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
                        {selectedNotes.length} notes selected
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
                className="h-14 w-14 mb-4 opacity-80"
              />
                    <h3 className="text-lg font-medium">自分のノートとチャットする</h3>
                    <p className="max-w-sm">
                      {notes.length > 0 ? (
                        selectedNotes.length > 0 ? (
                          "Ask questions about your selected notes."
                        ) : (
                          isMobile ? 
                          "Select notes above or ask questions about all your notes." :
                          "Select notes from the sidebar or ask questions about all your notes."
                        )
                      ) : (
                        "Create some notes first to chat with them."
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
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="ノートについて質問してください..."
                    className="flex-1"
                    disabled={sendNotesChatMessage.isPending}
                  />
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