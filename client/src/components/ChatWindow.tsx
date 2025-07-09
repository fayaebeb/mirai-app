// src/components/chat-window.tsx
import HomePage from "@/pages/home-page";
import { activeChatIdAtom } from "@/states/chatStates";
import { useRecoilValue } from "recoil";
import { FloatingDockDemo } from "./FloatingDoc";


export default function ChatWindow() {
    const activeChatId = useRecoilValue(activeChatIdAtom)

    return (
        <div className="flex-1 flex flex-col">
            {activeChatId ? (
                <div className="relative">
                    <HomePage />
                    
                    {/* <div className="fixed right -0  top-1/2 bottom-1/2 z-[9999]">
                        <FloatingDockDemo />
                    </div> */}
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground">
                    Select a chat or start a new one
                </div>
            )}
        </div>
    );
}
