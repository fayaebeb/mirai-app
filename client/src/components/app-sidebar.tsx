import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  GoalIcon,
  Map,
  PieChart,
  Plus,
  Settings2,
  SquareTerminal,
  Trash2,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { motion, AnimatePresence } from "framer-motion";
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuButton,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { useChats, useCreateChat, useDeleteChat } from "@/hooks/use-chat"
import { useRecoilState, useSetRecoilState } from "recoil"
import { activeChatIdAtom } from "@/states/chatStates"
import { sidePanelStateAtom } from "@/states/settingsState"
import { Button } from "./ui/button"
import { useAuth } from "@/hooks/use-auth"
import { activeTabState } from "@/states/activeTabState"

const itemVariants = {
  show: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};
// This is sample data.


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { open } = useSidebar()
  const { data: chats = [], isLoading } = useChats();
  const { mutate: createChat } = useCreateChat();
  const { mutate: deleteChat } = useDeleteChat();
  const { user } = useAuth()
  const [activeChatId, setActiveChatId] = useRecoilState(activeChatIdAtom);
  const [, setIsSidePanelOpen] = useRecoilState(sidePanelStateAtom);

  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [chatIdToDelete, setChatIdToDelete] = React.useState<number | null>(null);
  const [chatIdBeingDeleted, setChatIdBeingDeleted] = React.useState<number | null>(null);
  const CHAT_ACTIVE_KEY_PREFIX = "chat_active_";
  const [activeTab, setActiveTab] = useRecoilState(activeTabState);


  const data = {
    projects: [
      {
        name: "ボイスモッド",
        url: "#",
        icon: Frame,
        click: () => { setActiveTab('voice'); }
      },
      {
        name: "メモ",
        url: "#",
        icon: PieChart,
        click: () => { setActiveTab('notes') }
      },
      {
        name: "マインドマップ",
        url: "#",
        icon: Map,
        click: () => { setActiveTab('mindmap') }

      },
      {
        name: "ゴール",
        url: "#",
        icon: GoalIcon,
        click: () => { setActiveTab('goals');}

      },
    ],
  }

  const storageKey = `${CHAT_ACTIVE_KEY_PREFIX}${user?.id}`;

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

  React.useEffect(() => {
    if (user?.id && activeChatId !== null) {
      const expiration = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      const data = JSON.stringify({ id: activeChatId, expiresAt: expiration });
      localStorage.setItem(storageKey, data);
    }
  }, [user, activeChatId]);

  React.useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const isExpired = Date.now() > parsed.expiresAt;

          if (!isExpired) {
            setActiveChatId(parsed.id);
            return;
          }
        } catch {
          // corrupted or invalid format
          setActiveChatId(null)
        }
      }
      setActiveChatId(null);
    }
  }, [user, chats, storageKey]);

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="bg-black border-black hover:border-noble-black-900 text-noble-black-100 z-[50] "
        {...props}
      >
        {/* Outer wrapper: full-height flex column */}
        <div className={`${open ? "py-4 px-4 md:pr-0" : "pl-4 py-4"} h-full bg-black flex flex-col  `}>
          {/* Inner panel: flex-col, takes all available height */}
          <div
            className={`flex flex-col flex-1 relative overflow-hidden z-0 ${open ? "rounded-2xl" : "rounded-2xl"
              } bg-noble-black-900`}
          >
            {/* <div className=" h-40 w-40 rounded-full bg-gradient-to-br from-noble-black-300 to-noble-black-900 backdrop-blur-[200px] blur-2xl absolute -top-12 -left-10 z-0" /> */}
            <motion.div
              className="h-60 w-60 rounded-full bg-gradient-to-br from-noble-black-700 to-noble-black-900 backdrop-blur-[200px] blur-2xl absolute -top-12 -left-10 z-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: [0.4, 1, 0.4],
                scale: [0.8, 1, 0.8],
                x: [0, -20, 0],
                y: [0, 20, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            />
            {/* Header */}
            <SidebarHeader className="p-0 z-20">
              <div
                className={`flex items-center z-20 ${open ? "justify-between p-3" : "justify-center p-3"
                  }`}
              >
                {open && <div onClick={() => setActiveChatId(null)} className="text-xl font-semibold z-20 cursor-pointer text-noble-black-100">みらい</div>}
                <SidebarTrigger className="h-8 w-8 z-20 text-noble-black-100" />
              </div>
            </SidebarHeader>

            <div className={`h-px bg-noble-black-800 z-20`} />

            {/* Content area: flex-1, scrollable */}
            <SidebarContent className="p-2 flex-1 overflow-y-auto flex flex-col z-20">

              {open && (
                <div className="flex flex-col space-y-2 mb-2 z-20">
                  <Button
                    size="sm"
                    className="w-full bg-black border z-20 border-noble-black-100/20 hover:bg-gradient-to-br  hover:from-noble-black-900 hover:to-noble-black text-noble-black-100 hover:text-white rounded-lg shadow-md"
                    onClick={() =>
                      createChat(
                        { title: "新しいチャット" },
                        { onSuccess: (c) => { setActiveChatId(c.id); setActiveTab('chat'); } }
                      )
                    }
                  >
                    <Plus className="z-20" />
                    新しいチャット
                  </Button>

                  <SidebarGroupLabel className="text-noble-black-500 z-20">チャット</SidebarGroupLabel>


                  {chats.map((chat) =>
                    chat.id === chatIdBeingDeleted ? null : (
                      <motion.div
                        key={chat.id}
                        layout
                        variants={itemVariants}
                        initial="show"
                        animate="show"
                        exit="exit"
                      >
                        <SidebarMenuButton
                          className={`flex w-full justify-between items-center ${activeChatId === chat.id && (activeTab === "chat" || activeTab === "voice")
                            ? "bg-noble-black-100 text-noble-black-900"
                            : " text-noble-black-100"
                            }`}
                          onClick={() => { setActiveTab('chat'); setActiveChatId(chat.id) }}
                        >
                          <span className="truncate">{chat.title}</span>
                          <Trash2
                            size={16}
                            className="text-noble-black-400 hover:text-noble-black-900"
                            onClick={(e) => {
                              e.stopPropagation()
                              setChatIdToDelete(chat.id)
                              setShowDeleteDialog(true)
                            }}
                          />
                        </SidebarMenuButton>
                      </motion.div>
                    )
                  )}
                </div>
              )}

              <div className={`h-px bg-noble-black-800 ${open ? "flex" : "hidden"} `} />

              <NavProjects projects={data.projects} />
            </SidebarContent>

            <div className={`h-px bg-noble-black-800  z-20 ${open ? "flex" : "hidden"} `} />
            {/* <div className=" h-60 w-60 rounded-full bg-gradient-to-br from-noble-black-700 to-noble-black-900 backdrop-blur-[200px] blur-2xl absolute -bottom-12 -right-10 z-0" /> */}
            <motion.div
              className="h-32 w-32 rounded-full bg-gradient-to-br from-noble-black-700 to-noble-black-900 backdrop-blur-[200px] blur-2xl absolute -bottom-12 -right-20 z-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: [0.4, 1, 0.4],
                scale: [0.8, 1, 0.8],
                x: [0, -20, 0],
                y: [0, 20, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            />


            {/* Footer: always at bottom */}
            <SidebarFooter className="p-2 z-20 ">
              <NavUser
                name={user?.username ?? ""}
                email={user?.email ?? ""}
                avatar={user?.username ? user.username[0] : ""}
              />
            </SidebarFooter>
          </div>
        </div>

        <SidebarRail color="black" />
      </Sidebar>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="mx-auto max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl p-6 bg-black text-noble-black-100 border border-noble-black-900">

          <AlertDialogHeader>
            <AlertDialogTitle className="text-noble-black-100">チャット履歴をクリアしますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-noble-black-300">
              この操作は取り消せません。すべてのチャット履歴が削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-noble-black-900 text-noble-black-100  hover:bg-noble-black-800 border-0 hover:text-noble-black-100">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={chatIdToDelete === null}
              onClick={confirmDelete}
              className="bg-noble-black-100  text-noble-black-900 border border-noble-black-900 hover:text-noble-black-100"

            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
