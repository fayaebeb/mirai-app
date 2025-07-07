// src/hooks/use-chat-messages.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Message } from "@shared/schema";

/* ---------------------------------------------------------------
   1️⃣  Fetch all messages in a chat
   --------------------------------------------------------------- */
export function useChatMessages(chatId: number | null) {
  return useQuery<Message[], Error>({
    queryKey: ["/api/chats", chatId, "messages"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/chats/${chatId}/messages`);
      if (!res.ok) throw new Error("メッセージの取得に失敗しました。");
      return res.json() as Promise<Message[]>;
    },
    enabled: chatId !== null,
    staleTime: 0,
  });
}

/* ---------------------------------------------------------------
   2️⃣  Send a message
   --------------------------------------------------------------- */
interface SendPayload {
  chatId: number;
  content: string;
  useWeb?: boolean;
  useDb?: boolean;
}

export function useSendMessage(options?: {
  onSuccess?: (msg: Message) => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<Message, Error, SendPayload>({
    mutationFn: async ({ chatId, content, ...opts }) => {
      const res = await apiRequest("POST", "/api/messages", {
        chatId,
        content,
        ...opts,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "メッセージ送信に失敗しました。");
      }
      return res.json() as Promise<Message>;
    },
    onSuccess: (msg) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chats", msg.chatId, "messages"],
      });
      options?.onSuccess?.(msg);
    },
    onError: (err) => options?.onError?.(err),
  });
}

/* ---------------------------------------------------------------
   3️⃣  Delete all messages in a chat
   --------------------------------------------------------------- */
export function useClearChatMessages(options?: {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<void, Error, number>({
    mutationFn: async (chatId) => {
      const res = await apiRequest("DELETE", `/api/chats/${chatId}/messages`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "メッセージ削除に失敗しました。");
      }
    },
    onSuccess: (_void, chatId) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chats", chatId, "messages"],
      });
      options?.onSuccess?.();
    },
    onError: (err) => options?.onError?.(err),
  });
}
