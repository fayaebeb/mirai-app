// src/pages/app-layout.tsx
import React from "react";
import HomePage from "./home-page";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingSidebar from "@/components/Sidepanel";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useRecoilValue, useRecoilState } from "recoil";
import { activeChatIdAtom } from "@/states/chatStates";
import { sidePanelStateAtom } from "@/states/settingsState";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateChat } from "@/hooks/use-chat";

export default function AppLayout() {
    const [activeChatId, setActiveChatId] = useRecoilState(activeChatIdAtom);

    const [, setIsSidePanelOpen] = useRecoilState(sidePanelStateAtom);
    const { mutate: createChat } = useCreateChat();


    return ( 
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
            <SidebarProvider>
                <Navbar />

                <FloatingSidebar />
                {activeChatId ? (
                    <div className="w-full">
                    <HomePage />
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-full">


                        <main className="flex-1 flex items-center justify-center p-6">



                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="flex flex-col items-center space-y-6 text-center"
                            >
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    className="p-4 rounded-full bg-blue-900/50"
                                >
                                    <MessageSquare className="h-16 w-16 text-blue-400" />
                                </motion.div>

                                <h2 className="text-2xl font-semibold text-white">
                                    Select a chat or start a new one
                                </h2>

                                <Button
                                    variant="outline"
                                    className="border-blue-500 text-blue-300 hover:bg-blue-500 hover:text-white"
                                    onClick={() =>
                                        createChat({ title: "New Chat" }, { onSuccess: (c) => setActiveChatId(c.id) })
                                    }
                                >
                                    + New Chat
                                </Button>
                            </motion.div>

                        </main>

                    </div>

                )}
                <Footer />
            </SidebarProvider>
        </div>
    )
}

