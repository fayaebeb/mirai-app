// src/hooks/useRenameChat.ts
import { Chat } from "@shared/schema";
import { useMutation, useQueryClient, QueryKey } from "@tanstack/react-query";

export type RenameChatInput = {
  chatId: number;
  title: string;
};

export function useRenameChat() {
  const queryClient = useQueryClient();
  const chatsKey: QueryKey = ["/api/chats"];

  return useMutation<Chat, Error, RenameChatInput>({
    mutationFn: async ({ chatId, title }) => {
      const res = await fetch(`/api/chats/${chatId}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to rename chat");
      }
      return res.json() as Promise<Chat>;
    },
    onSuccess(updatedChat) {
      // 1) Update the cached list in-place
      queryClient.setQueryData<Chat[]>(chatsKey, (old) =>
        old?.map((c) =>
          c.id === updatedChat.id ? { ...c, title: updatedChat.title } : c
        ) ?? []
      );

      // 2) Optionally, refetch from server if you want to re-sync
      // queryClient.invalidateQueries({ queryKey: chatsKey });
    },
  });
}
