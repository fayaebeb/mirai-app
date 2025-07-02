import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginPayload>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterPayload>;
};

// type LoginData = Pick<InsertUser, "email" | "password">;

type LoginPayload = {
  email: string;
  password: string;
  turnstileToken: string;
};
type RegisterPayload = InsertUser & { turnstileToken: string };

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const [, setLocation] = useLocation();

  // When the component mounts, refetch the user data to validate the session
  useEffect(() => {
    refetch();

    // Setup periodic session check every 5 minutes
    const interval = setInterval(() => {
      console.log("Auth - Periodic session refresh");
      refetch();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refetch]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginPayload) => {
      console.log("Auth - Login attempt", { email: credentials.email });
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "ログインに失敗しました。");
      }
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      console.log("Auth - Login successful");
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "ログイン成功",
        description: "ようこそ！桜AIがあなたをお待ちしていました。",
      });
    },
    onError: (error: Error) => {
      console.error("Auth - Login failed", error);
      toast({
        title: "ログインに失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterPayload) => {
      console.log("Auth - Register attempt", { email: credentials.email });
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      console.log("Auth - Registration successful");
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "登録成功",
        description: "アカウントが作成されました！桜AIとおしゃべりを始めましょう。",
      });
    },
    onError: (error: Error) => {
      console.error("Auth - Registration failed", error);
      toast({
        title: "登録に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("Auth - Logout attempt");
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      console.log("Auth - Logout successful");
      queryClient.setQueryData(["/api/user"], null);
      setLocation("/auth");
      toast({
        title: "ログアウト成功",
        description: "またのご利用をお待ちしております。",
      });
    },
    onError: (error: Error) => {
      console.error("Auth - Logout failed", error);
      toast({
        title: "ログアウトに失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}