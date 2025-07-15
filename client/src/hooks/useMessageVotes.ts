import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useUpdateMessageVote() {
  const queryClient = useQueryClient();

  return useMutation<
    { vote: -1 | 0 | 1 },
    Error,
    { messageId: number; value: -1 | 1; chatId?: number }
  >({
    mutationFn: async ({ messageId, value }) => {
      const res = await apiRequest("POST", "/api/votes", { messageId, value });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update vote");
      }
      return res.json();
    },
    onSuccess: ({ vote }, { messageId }) => {
      // Update message list cache
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey.includes("messages") },
        (old: any) => {
          if (!old) return old;
          return Array.isArray(old)
            ? old.map((msg) =>
                msg.id === messageId ? { ...msg, vote } : msg
              )
            : old;
        }
      );

      // Optionally update vote status query
      queryClient.setQueryData(["/api/votes", messageId], { vote });
    },
  });
}