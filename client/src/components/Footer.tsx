import { useState } from "react";
import { motion } from "framer-motion";
import { useRecoilValue } from "recoil";
import { activeTabState } from "@/states/activeTabState";


const Footer = () => {
    const activeTab = useRecoilValue(activeTabState)

    return (
        <>
            {activeTab !== "chat" && (
                <footer className="border-t border-blue-900/30 py-2 bg-slate-950/60 backdrop-blur-md">
                    <div className="container mx-auto px-4 text-center">
                        <motion.p
                            className="text-xs text-blue-400/80 font-mono"
                            animate={{ opacity: [0.6, 1, 0.6] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        >
                            <span className="text-blue-500">⦿</span> ミライ – FSDのAIアシスタント <span className="text-blue-500">⦿</span>
                        </motion.p>
                    </div>
                </footer>
            )}
        </>
    )
}

export default Footer