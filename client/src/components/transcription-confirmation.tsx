import { useState, useEffect, useRef } from "react";
import { Check, X, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface TranscriptionConfirmationProps {
  text: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
  onEdit: (text: string) => void;
}

export default function TranscriptionConfirmation({
  text,
  onConfirm,
  onCancel,
  onEdit,
}: TranscriptionConfirmationProps) {
  const [editedText, setEditedText] = useState(text);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Detect if we're on mobile
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

  useEffect(() => {
    setEditedText(text);
  }, [text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);
  
  // Add event listener for keyboard shortcuts
  useEffect(() => {
    if (isMobile) return; // Don't add keyboard shortcuts on mobile
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process if our component is visible/mounted
      if (!containerRef.current) return;
      
      // Enter key for confirmation (when not editing)
      if (e.key === "Enter" && !e.shiftKey && !isEditing) {
        e.preventDefault();
        handleConfirm();
      }
      
      // Escape key to cancel
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      
      // Enter key to save edits (when editing)
      if (e.key === "Enter" && !e.shiftKey && isEditing && e.ctrlKey) {
        e.preventDefault();
        handleSaveEdit();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, isEditing, editedText]);

  const handleConfirm = () => {
    onConfirm(editedText);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    onEdit(editedText);
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full bg-accent/50 backdrop-blur-sm border border-border rounded-lg p-3 mb-3"
    >
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium flex items-center justify-between">
          <span className="bg-pink-100 text-pink-700 text-xs px-2 py-0.5 rounded-full">
            音声トランスクリプション
          </span>
          {!isMobile && !isEditing && (
            <span className="text-xs px-2 py-1 bg-muted rounded-md flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">Enter</kbd>
              <span>キーで送信</span>
            </span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <textarea
                ref={textareaRef}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-pink-200 focus:border-pink-400 outline-none resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedText(text);
                  }}
                >
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  保存
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="viewing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <p className="text-sm p-2 bg-background rounded-md">{editedText}</p>
              <div className="flex justify-between items-center mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={handleEdit}
                >
                  <Edit2 className="h-3 w-3" />
                  編集
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={onCancel}
                  >
                    <X className="h-3 w-3" />
                    取り消し
                  </Button>
                  <Button
                    size="sm"
                    className="flex items-center gap-1 bg-gradient-to-r from-pink-400 to-pink-500 text-white"
                    onClick={handleConfirm}
                  >
                    <Check className="h-3 w-3" />
                    送信
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}