import React, { useState } from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Zap, Book, Target, Trash2, BrainCircuit, Menu, Home, X, Download, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRecoilState } from 'recoil';
import { ActiveTab, activeTabState } from '@/states/activeTabState';
import { Message } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
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
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ChatPDFExport } from './chat-pdf-export';
import { useToast } from '@/hooks/use-toast';

const Navbar = () => {

    const [activeTab, setActiveTab] = useRecoilState(activeTabState)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const { user, logoutMutation } = useAuth();
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const { toast } = useToast();

    const { data: messages = [] } = useQuery<Message[]>({
        queryKey: ['/api/messages'],
        enabled: !!user,
    });

    const handleClearChat = () => {
        setShowClearConfirm(true);
    };

    const clearChatHistory = useMutation({
        mutationFn: async () => {
            const response = await apiRequest(
                'DELETE',
                '/api/messages'
            );
            return response.json();
        },
        onSuccess: () => {
            // Clear the messages in the query cache
            queryClient.setQueryData<Message[]>(['/api/messages'], []);

            // Close the confirmation dialog
            setShowClearConfirm(false);

            // Show success toast
            toast({
                title: "チャット履歴をクリアしました",
                description: "すべてのメッセージが削除されました。",
            });
        },
        onError: (error) => {
            console.error("Error clearing chat history:", error);
            toast({
                title: "エラーが発生しました",
                description: "チャット履歴のクリアに失敗しました。",
                variant: "destructive"
            });
        }
    });

    const handleTabChange = (value: string) => {
        setActiveTab(value as ActiveTab);
    };

    const displayName = user?.username;




    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-blue-900/50 bg-slate-950/90 backdrop-blur-lg shadow-md">
                <div className="max-w-full px-2.5 sm:px-4 py-1.5">
                    <div className="flex justify-between items-center">
                        {/* LEFT GROUP: mobile menu + logo */}
                        <div className="flex items-center space-x-2">
                            {/* Mobile Menu */}
                            <div className="md:hidden">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-blue-300 hover:bg-blue-900/20 h-8 w-8 p-0 flex items-center justify-center"
                                        >
                                            <Menu className="h-4 w-4" />
                                            <span className="sr-only">Navigation Menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent align="end" className="bg-slate-900 border border-blue-500/30 w-40">
                                        <DropdownMenuLabel className="text-xs text-blue-300/70">
                                            メニュー
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-blue-900/30" />

                                        <DropdownMenuItem
                                            className={`text-blue-300 hover:bg-blue-800/30 cursor-pointer flex items-center gap-2 ${activeTab === "chat" ? "bg-blue-800/40" : ""}`}
                                            onClick={() => setActiveTab("chat")}
                                        >
                                            <Home className="h-3.5 w-3.5 text-blue-400" />
                                            <span className="text-sm">ホーム</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            className={`text-blue-300 hover:bg-blue-800/30 cursor-pointer flex items-center gap-2 ${activeTab === "notes" ? "bg-blue-800/40" : ""}`}
                                            onClick={() => setActiveTab("notes")}
                                        >
                                            <Book className="h-3.5 w-3.5 text-blue-400" />
                                            <span className="text-sm">ノート</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            className={`text-blue-300 hover:bg-blue-800/30 cursor-pointer flex items-center gap-2 ${activeTab === "goals" ? "bg-blue-800/40" : ""}`}
                                            onClick={() => setActiveTab("goals")}
                                        >
                                            <Target className="h-3.5 w-3.5 text-blue-400" />
                                            <span className="text-sm">タスク</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            className={`text-blue-300 hover:bg-blue-800/30 cursor-pointer flex items-center gap-2 ${activeTab === "mindmap" ? "bg-blue-800/40" : ""}`}
                                            onClick={() => setActiveTab("mindmap")}
                                        >
                                            <BrainCircuit className="h-3.5 w-3.5 text-blue-400" />
                                            <span className="text-sm">マインドマップ</span>
                                        </DropdownMenuItem>

                                        {/* separator before logout */}
                                        <DropdownMenuSeparator className="bg-blue-900/30" />

                                        {/* logout item */}
                                        <DropdownMenuItem
                                            className="text-blue-300 hover:bg-blue-800/30 cursor-pointer flex items-center gap-2"
                                            onClick={() => setShowLogoutConfirm(true)}
                                            disabled={logoutMutation.isPending}
                                        >
                                            <LogOut className="h-3.5 w-3.5 text-blue-400" />
                                            <span className="text-sm">ログアウト</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>


                            {/* Logo + Brand */}
                            <div
                                onClick={() => setActiveTab("chat")}
                                className="flex items-center space-x-1.5 sm:space-x-3 cursor-pointer"
                            >
                                <motion.div
                                    className="h-9 w-9 sm:h-12 sm:w-12"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <img
                                        src="/images/mirai.png"
                                        alt="Company Logo"
                                        className="h-full w-full object-contain"
                                    />
                                </motion.div>
                                <div
                                    className="relative font-mono text-lg sm:text-xl lg:text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 font-extrabold whitespace-nowrap flex-shrink-0"
                                >
                                    ミライ
                                    <motion.div
                                        className="absolute inset-0 -z-10 rounded-full border border-cyan-400/20"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                    />
                                </div>
                            </div>
                        </div>


                        {/* Center: View Tabs - desktop only */}
                        <div className="hidden md:flex justify-center items-center">
                            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                                <TabsList className="bg-slate-800/50 border border-blue-500/20">
                                    <TabsTrigger
                                        value="chat"
                                        className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 gap-1.5"
                                    >
                                        <Home className="h-3.5 w-3.5" />
                                        <span>ホーム</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="notes"
                                        className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 gap-1.5"
                                    >
                                        <Book className="h-3.5 w-3.5" />
                                        <span>ノート</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="goals"
                                        className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 gap-1.5"
                                    >
                                        <Target className="h-3.5 w-3.5" />
                                        <span>タスク</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="mindmap"
                                        className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 gap-1.5"
                                    >
                                        <BrainCircuit className="h-3.5 w-3.5" />
                                        <span>マインドマップ</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* Right: User Info & Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            {activeTab === "chat" && messages.length > 0 && (
                                <>
                                    <Button
                                        variant="ghost"
                                        onClick={handleClearChat}
                                        className="text-blue-300 hover:bg-blue-800/30 flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2"
                                    >
                                        <Trash2 className="h-4 w-4 text-blue-400" />
                                        <span className="hidden sm:inline">チャット履歴をクリア</span>
                                    </Button>

                                    <ChatPDFExport
                                        messages={messages}
                                        triggerContent={
                                            <>
                                                <Download className="h-2 w-2 sm:h-3 sm:w-3" />
                                                <span className="hidden sm:inline">エクスポート</span>
                                            </>
                                        }
                                        triggerClassName="
                      gap-0.5 
                      px-2 py-1 text-xs
                      sm:gap-1 sm:px-2 sm:py-1.5 sm:text-sm
                    "
                                    />
                                </>
                            )}




                            {/* Username badge */}
                            <AnimatePresence>
                                {displayName && (
                                    <motion.div
                                        className="flex items-center gap-1 bg-slate-800/70 px-2 py-1 rounded-md border border-blue-500/20 backdrop-blur-sm"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <motion.span
                                            className="text-xs sm:text-sm font-medium text-blue-300 font-mono"
                                            animate={{ scale: [1, 1.02, 1] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        >
                                            <span className="sm:hidden">
                                                {displayName.charAt(0).toUpperCase()}
                                            </span>
                                            <span className="hidden sm:inline">
                                                {displayName}
                                            </span>
                                        </motion.span>
                                        <Zap className="h-3 w-3 text-blue-400" />
                                    </motion.div>
                                )}
                            </AnimatePresence>


                            {/* Logout button */}
                            <motion.div
                                // hidden by default (all sizes), becomes flex (or block) at sm+
                                className="hidden sm:flex"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowLogoutConfirm(true)}
                                    disabled={logoutMutation.isPending}
                                    className="text-blue-300 hover:bg-blue-900/20 h-8 w-8 sm:h-9 sm:w-9"
                                >
                                    <LogOut className="h-3.5 w-3.5" />
                                </Button>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </header>
            <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
                <AlertDialogContent className="mx-auto max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl p-6">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-blue-100">ログアウトしますか？</AlertDialogTitle>
                        <AlertDialogDescription className="text-blue-300/70">
                            ログアウトすると、セッションが終了します。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 text-blue-200 border-slate-700 hover:bg-slate-700">
                            キャンセル
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => logoutMutation.mutate()}
                            className="bg-red-900/50 hover:bg-red-900 text-red-50 border border-red-800"
                        >
                            ログアウト
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
                <AlertDialogContent className="mx-auto max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl p-6">

                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-blue-100">チャット履歴をクリアしますか？</AlertDialogTitle>
                        <AlertDialogDescription className="text-blue-300/70">
                            この操作は取り消せません。すべてのチャット履歴が削除されます。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 text-blue-200 border-slate-700 hover:bg-slate-700">
                            キャンセル
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => clearChatHistory.mutate()}
                            className="bg-red-900/50 hover:bg-red-900 text-red-50 border border-red-800"
                        >
                            削除する
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export default Navbar