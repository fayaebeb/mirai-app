// src/hooks/use-chats.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Chat } from "@shared/schema";

/* ───────── fetch all chats ───────────────────────────────────────── */

export function useChats(enabled = true) {
  return useQuery<Chat[], Error>({
    queryKey: ["/api/chats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chats");
      if (!res.ok) throw new Error("チャット一覧の取得に失敗しました。");
      return res.json() as Promise<Chat[]>;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/* ───────── create a new chat ────────────────────────────────────── */

export function useCreateChat(options?: {
  onSuccess?: (chat: Chat) => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<Chat, Error, { title?: string }>({
    mutationFn: async ({ title }) => {
      const res = await apiRequest("POST", "/api/chats", { title });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "チャットの作成に失敗しました。");
      }
      return res.json() as Promise<Chat>;
    },
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      options?.onSuccess?.(chat);
    },
    onError: (err) => options?.onError?.(err),
  });
}

/* ───────── delete a chat ───────────────────────────────────────── */

export function useDeleteChat(options?: {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<void, Error, number>({
    mutationFn: async (chatId) => {
      const res = await apiRequest("DELETE", `/api/chats/${chatId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "チャットの削除に失敗しました。");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      options?.onSuccess?.();
    },
    onError: (err) => options?.onError?.(err),
  });
}
