import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

/**
 * useChangePassword
 *
 * Usage:
 * const { mutate, isPending } = useChangePassword({ onSuccess, onError });
 */
export function useChangePassword(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useMutation<void, Error, ChangePasswordPayload>({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", "/api/change-password", payload);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "パスワードの変更に失敗しました。");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      options?.onSuccess?.();
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}
