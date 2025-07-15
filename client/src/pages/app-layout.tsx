// src/pages/app-layout.tsx
import React from "react";
import HomePage from "./home-page";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingSidebar from "@/components/Sidepanel";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useRecoilValue, useRecoilState } from "recoil";
import { activeChatIdAtom } from "@/states/chatStates";
import { sidePanelStateAtom } from "@/states/settingsState";
import { motion } from "framer-motion";
import { Home, MessageSquare, PlusIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateChat } from "@/hooks/use-chat";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Spotlight } from "@/components/ui/spotlight";
import { TextGenerateEffect } from "@/components/ui/textgenerateEffect";
import { activeTabState } from "@/states/activeTabState";

export default function AppLayout() {
    const [activeChatId, setActiveChatId] = useRecoilState(activeChatIdAtom);

    const [, setIsSidePanelOpen] = useRecoilState(sidePanelStateAtom);
    const { mutate: createChat } = useCreateChat();
    const activeTab = useRecoilValue(activeTabState)


    return (
        // <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
        //     <SidebarProvider>
        //         <Navbar />

        //         <FloatingSidebar />
        //         {activeChatId ? (
        //             <div className="w-full">
        //             <HomePage />
        //             </div>
        //         ) : (
        //             <div className="flex items-center justify-center w-full">


        //                 <main className="flex-1 flex items-center justify-center p-6">



        //                     <motion.div
        //                         initial={{ opacity: 0, y: 20 }}
        //                         animate={{ opacity: 1, y: 0 }}
        //                         transition={{ duration: 0.5 }}
        //                         className="flex flex-col items-center space-y-6 text-center"
        //                     >
        //                         <motion.div
        //                             animate={{ scale: [1, 1.2, 1] }}
        //                             transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        //                             className="p-4 rounded-full bg-blue-900/50"
        //                         >
        //                             <MessageSquare className="h-16 w-16 text-blue-400" />
        //                         </motion.div>

        //                         <h2 className="text-2xl font-semibold text-white">
        //                             Select a chat or start a new one
        //                         </h2>

        //                         <Button
        //                             variant="outline"
        //                             className="border-blue-500 text-blue-300 hover:bg-blue-500 hover:text-white"
        //                             onClick={() =>
        //                                 createChat({ title: "New Chat" }, { onSuccess: (c) => setActiveChatId(c.id) })
        //                             }
        //                         >
        //                             + New Chat
        //                         </Button>
        //                     </motion.div>

        //                 </main>

        //             </div>

        //         )}
        //         <Footer />
        //     </SidebarProvider>
        // </div>
        <SidebarProvider >
            <AppSidebar />
            <SidebarInset>
                <div className="flex flex-1 flex-col gap-4 p-4 bg-black relative  max-h-screen h-screen">
                    <div className="flex flex-col min-h-full max-h-full bg-noble-black-900 rounded-2xl relative overflow-hidden">
                        <SidebarTrigger className="rounded-full p-5 bg-black text-noble-black-100 absolute left-2 top-2 md:hidden z-50 border border-noble-black-900" />

                        {activeChatId  ?
                            <HomePage />
                            :
                            <div className="h-full w-full rounded-md flex md:items-center md:justify-center  antialiased  overflow-hidden relative">
                                <Spotlight />
                                <div className=" p-4 max-w-7xl  mx-auto relative z-10  w-full pt-20 md:pt-0 space-y-4">
                                    {/* <h1 className="text-4xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50">
                                        Mirai AI <br /> Internal Information Bot for FSD.
                                    </h1> */}
                                    <TextGenerateEffect duration={1.2} className="text-5xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50" words="みらいボット" />
                                    <TextGenerateEffect duration={1.2} className="text-2xl md:text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50" words="FSDの社内情報をサポートするボットです。" />

                                    <motion.p
                                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 1 }}
                                        className="mt-4 font-normal text-base text-neutral-300 max-w-lg text-center mx-auto">
                                        チャットボットの使用を開始するには、新しいチャットを作成します。
                                    </motion.p>
                                    <div className="flex items-center justify-center">
                                        {/* <Button
                                            onClick={() =>
                                                createChat({ title: "New Chat" }, { onSuccess: (c) => setActiveChatId(c.id) })
                                            }
                                            className="text-noble-black-900 bg-white hover:text-noble-black-300 hover:bg-black  rounded-full ">
                                            <PlusIcon />
                                            <span>Create Chat</span>


                                        </Button> */}
                                        <motion.button
                                            // initial entrance
                                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 1 }}

                                            // hover & tap interactions
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}

                                            onClick={() =>
                                                createChat({ title: "New Chat" }, { onSuccess: (c) => setActiveChatId(c.id) })
                                            }
                                            className="flex items-center text-noble-black-100/80 bg-black/90 rounded-full
                                        hover:text-noble-black-300 hover:bg-black
                                        px-4   py-2 shadow-lg text-md"
                                        >
                                            <PlusIcon className="mr-1 h-5 w-5" />
                                            新しいチャット
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                            // <div className=" flex flex-col items-center justify-center h-full px-40">
                            //     <Spotlight />
                            //     <motion.div
                            //         initial={{ opacity: 0, y: 20 }}
                            //         animate={{ opacity: 1, y: 0 }}
                            //         transition={{ duration: 0.5 }}
                            //         className="flex flex-col space-y-4 items-center justify-center"
                            //     >
                            //         <div className="">
                            //             <motion.div
                            //                 className=""
                            //                 animate={{
                            //                     scale: [1, 1.1, 1],
                            //                     opacity: [0.3, 0.5, 0.3],
                            //                     rotate: 360,
                            //                 }}
                            //                 transition={{
                            //                     duration: 4,
                            //                     repeat: Infinity,
                            //                     ease: "linear",
                            //                 }}
                            //             />
                            //             <Sparkles className="h-10 w-10 text-black" />
                            //         </div>

                            //         <h3 className="text-2xl md:text-5xl font-medium mb-2 text-noble-black-100">
                            //             対話を始めましょう
                            //         </h3>
                            //         <p className="text-noble-black-300/80 max-w-xs mx-auto text-sm text-center">
                            //             下のテキストボックスにメッセージを入力して、
                            //             <br />
                            //             ミライと対話を開始してください
                            //         </p>

                            //         {/* New: Quick start suggestions */}
                            //         <div className="mt-5 space-y-2">
                            //             <p className="text-xs text-black font-semibold text-center">
                            //                 試してみる:
                            //             </p>
                            //             <div className="grid md:grid-cols-4 gap-5">

                            //                 <motion.button

                            //                     whileHover={{ scale: 1.05 }}
                            //                     whileTap={{ scale: 0.95 }}
                            //                     className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                            //                 >
                            //                     ボイスモッド
                            //                 </motion.button>
                            //                 <motion.button

                            //                     whileHover={{ scale: 1.05 }}
                            //                     whileTap={{ scale: 0.95 }}
                            //                     className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                            //                 >
                            //                     メモ
                            //                 </motion.button>
                            //                 <motion.button  

                            //                     whileHover={{ scale: 1.05 }}
                            //                     whileTap={{ scale: 0.95 }}
                            //                     className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                            //                 >
                            //                     マインドマップ
                            //                 </motion.button>
                            //                 <motion.button  

                            //                     whileHover={{ scale: 1.05 }}
                            //                     whileTap={{ scale: 0.95 }}
                            //                     className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                            //                 >
                            //                     ゴール
                            //                 </motion.button>

                            //             </div>
                            //         </div>
                            //         <div className="mt-5 space-y-2">
                            //             <p className="text-xs text-black font-semibold text-center">
                            //                 試してみる:
                            //             </p>
                            //             <div className="grid md:grid-cols-3 gap-5">

                            //                 <motion.button

                            //                     whileHover={{ scale: 1.05 }}
                            //                     whileTap={{ scale: 0.95 }}
                            //                     className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                            //                 >
                            //                     Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, corporis ut laboriosam, distinctio suscipit cum autem sint eveniet doloremque corrupti harum placeat rem, sed repudiandae nostrum nemo sequi modi incidunt!
                            //                 </motion.button>
                            //                 <motion.button

                            //                     whileHover={{ scale: 1.05 }}
                            //                     whileTap={{ scale: 0.95 }}
                            //                     className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                            //                 >
                            //                     Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, corporis ut laboriosam, distinctio suscipit cum autem sint eveniet doloremque corrupti harum placeat rem, sed repudiandae nostrum nemo sequi modi incidunt!
                            //                 </motion.button>
                            //                 <motion.button

                            //                     whileHover={{ scale: 1.05 }}
                            //                     whileTap={{ scale: 0.95 }}
                            //                     className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br   text-noble-black-400 rounded-lg shadow-md text-sm p-5"
                            //                 >
                            //                     Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, corporis ut laboriosam, distinctio suscipit cum autem sint eveniet doloremque corrupti harum placeat rem, sed repudiandae nostrum nemo sequi modi incidunt!
                            //                 </motion.button>

                            //             </div>
                            //         </div>
                            //     </motion.div>
                            // </div>
                        }
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider >
    )
}

