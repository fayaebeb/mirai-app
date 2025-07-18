// src/components/FloatingSidebar.tsx
import React, { useEffect, useState } from "react";
import {
    Sheet,
    SheetPortal,
    SheetOverlay,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Menu, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRecoilState } from "recoil";
import { activeChatIdAtom } from "@/states/chatStates";
import { sidePanelStateAtom } from "@/states/settingsState";
import { useChats, useCreateChat, useDeleteChat } from "@/hooks/use-chat";

const itemVariants = {
    show: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

export default function FloatingSidebar() {
    const { data: chats = [], isLoading } = useChats();
    const { mutate: createChat } = useCreateChat();
    const { mutate: deleteChat } = useDeleteChat();

    const [activeChatId, setActiveChatId] = useRecoilState(activeChatIdAtom);
    const [, setIsSidePanelOpen] = useRecoilState(sidePanelStateAtom);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [chatIdToDelete, setChatIdToDelete] = useState<number | null>(null);
    const [chatIdBeingDeleted, setChatIdBeingDeleted] = useState<number | null>(null);

    const confirmDelete = () => {
        if (chatIdToDelete !== null) {
            setChatIdBeingDeleted(chatIdToDelete);
            setShowDeleteDialog(false);
            setTimeout(() => {
                deleteChat(chatIdToDelete);
                if (activeChatId === chatIdToDelete) {
                    setActiveChatId(null);
                }
                setChatIdBeingDeleted(null);
                setChatIdToDelete(null);
            }, 200);
        }
    };

    return (
        <>
            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="fixed top-20 left-6 z-50 rounded-full bg-blue-500/40 backdrop-blur-md shadow-lg"
                    >
                        <Menu className="h-5 w-5 text-blue-300" />
                        <span className="sr-only">Open sidebar</span>
                    </Button>
                </SheetTrigger>

                <SheetPortal>
                    <SheetOverlay className="bg-black/0" />
                    <SheetContent
                        side="left"
                        className="w-80 h-full flex flex-col bg-slate-950/90 backdrop-blur-lg shadow-md p-6 border-r border-blue-900/50"
                    >
                        {/* HEADER */}
                        <SheetHeader className="pb-4 border-b border-purple-600">
                            <SheetTitle className="text-2xl font-extrabold text-white tracking-widest">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                    className="flex items-center"
                                >
                                    <img src="/images/pclogo.png" alt="Logo" className="w-full" />
                                </motion.div>
                            </SheetTitle>
                        </SheetHeader>

                        {/* CREATE */}
                        <div className="mt-4 px-4">
                            {/* <Button
                                size="sm"
                                className="w-full bg-gradient-to-r from-violet-400 to-violet-500 text-violet-900 hover:text-white rounded-xl shadow-md"
                                onClick={() =>
                                    createChat({ title: "New Chat" }, { onSuccess: (c) => setActiveChatId(c.id) })
                                }
                            >
                                + New Chat
                            </Button> */}
                        </div>

                        {/* LIST WRAPPER */}
                        <div className="mt-4 flex-1 overflow-y-auto px-4">
                            {isLoading ? (
                                <p className="text-sm text-gray-400">Loading chats…</p>
                            ) : (
                                <motion.ul layout initial={false}>
                                    <AnimatePresence>
                                        {chats.map((chat) =>
                                            chat.id === chatIdBeingDeleted ? null : (
                                                <motion.li
                                                    key={chat.id}
                                                    layout
                                                    variants={itemVariants}
                                                    initial="show"
                                                    animate="show"
                                                    exit="exit"
                                                    className={`group flex items-center justify-between px-3 py-2 mb-2 rounded-xl cursor-pointer ${activeChatId === chat.id
                                                            ? "bg-gradient-to-r from-blue-700 text-white"
                                                            : "hover:bg-purple-700/30 text-gray-200"
                                                        }`}
                                                    onClick={() => setActiveChatId(chat.id)}
                                                >
                                                    <span className="truncate">{chat.title}</span>
                                                    <Trash2
                                                        size={16}
                                                        className="opacity-0 group-hover:opacity-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setChatIdToDelete(chat.id);
                                                            setShowDeleteDialog(true);
                                                        }}
                                                    />
                                                </motion.li>
                                            )
                                        )}
                                    </AnimatePresence>
                                </motion.ul>
                            )}
                        </div>
                    </SheetContent>
                </SheetPortal>
            </Sheet>

            {/* DELETE DIALOG */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="max-w-sm mx-auto rounded-xl p-6">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg text-white">
                            Delete this chat?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400">
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="px-4 py-2 bg-gray-800 rounded mr-2"
                            onClick={() => setChatIdToDelete(null)}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="px-4 py-2 bg-red-700 rounded text-white"
                            disabled={chatIdToDelete === null}
                            onClick={confirmDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
