// src/components/sidebar.tsx
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useChats, useCreateChat, useDeleteChat } from "@/hooks/use-chat";
import { useRecoilState } from "recoil";
import { activeChatIdAtom } from "@/states/chatStates";
import { useAuth } from "@/hooks/use-auth";

export default function Sidebar() {
    /* 1️⃣  grab the list */
    const {
        data: chats = [],
        isLoading,
        error,
    } = useChats(); // ← your hook
    const { user } = useAuth()

    /* 2️⃣  mutations */
    const { mutate: createChat } = useCreateChat();
    const { mutate: deleteChat } = useDeleteChat();
    const CHAT_ACTIVE_KEY_PREFIX = "chat_active_";
    const storageKey = `${CHAT_ACTIVE_KEY_PREFIX}${user?.id}`;


    /* 3️⃣  local UI state */
    const [activeChatId, setActiveChatId] = useRecoilState(activeChatIdAtom)
    const [editingId, setEditingId] = useState<number | null>(null);
    const [draftTitle, setDraftTitle] = useState("");


    useEffect(() => {
        if (user?.id && activeChatId !== null) {
            const expiration = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
            const data = JSON.stringify({ id: activeChatId, expiresAt: expiration });
            localStorage.setItem(storageKey, data);
        }
    }, [user, activeChatId]);

    useEffect(() => {
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

    if (isLoading) return <aside className="w-72">Loading…</aside>;
    if (error) return <aside className="w-72">Error: {error.message}</aside>;

    return (
        <div className="w-72 border-r bg-muted fixed flex flex-col z-[9999]">
            {/* create */}
            <button
                className="p-3 flex items-center gap-2 hover:bg-muted text-sm"
                onClick={() => createChat({}, { onSuccess: (c) => setActiveChatId(c.id) })}
            >
                <Plus size={16} /> New chat
            </button>

            {/* list */}
            <ul className="flex-1 overflow-y-auto">
                {chats
                    .filter((c) => c.type === "regular") // hide assistants if you like
                    .map((chat) => (
                        <li
                            key={chat.id}
                            onClick={() => setActiveChatId(chat.id)}
                            className={clsx(
                                "group flex items-center justify-between px-3 py-2 cursor-pointer",
                                activeChatId === chat.id && "bg-accent text-accent-foreground"
                            )}
                        >
                            {editingId === chat.id ? (
                                <input
                                    value={draftTitle}
                                    onChange={(e) => setDraftTitle(e.target.value)}
                                    onBlur={() => setEditingId(null)}
                                    className="flex-1 bg-transparent outline-none text-sm"
                                    autoFocus
                                />
                            ) : (
                                <span className="truncate text-sm flex-1">{chat.title}</span>
                            )}

                            <button
                                className="invisible group-hover:visible p-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteChat(chat.id);
                                    if (activeChatId === chat.id) {
                                        setActiveChatId(null)
                                        
                                    };
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </li>
                    ))}
            </ul>
        </div>
    );
}
