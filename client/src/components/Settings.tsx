import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { useRecoilState } from "recoil";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Input } from "./ui/input";
import { Heart, Star, Eye, EyeOff, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import zxcvbn from "zxcvbn";
import { Button } from "./ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { settingsStateAtom } from "@/states/settingsState";
import { useChangePassword } from "@/hooks/useChangePass";
import { Trio } from "ldrs/react";

// ✅ Zod Schema
const passwordSchema = z
    .object({
        email: z.string().email("無効なメールアドレスです"),
        oldPassword: z.string().min(8, "現在のパスワードを入力してください"),
        password: z
            .string()
            .min(8, "パスワードは8文字以上である必要があります")
            .regex(/[A-Z]/, "大文字が必要です")
            .regex(/[a-z]/, "小文字が必要です")
            .regex(/[0-9]/, "数字が必要です")
            .regex(/[\W_]/, "記号が必要です"),
        confirmPassword: z
            .string()
            .min(8, "確認用パスワードは8文字以上である必要があります"),
        inviteToken: z.string().optional(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: "パスワードが一致しません",
        path: ["confirmPassword"],
    });

type FormValues = z.infer<typeof passwordSchema>;

const Settings = () => {
    const [isSettingsOpen, setIsSettingsOpen] = useRecoilState(settingsStateAtom);
    const [showPassword, setShowPassword] = useState(false);
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const form = useForm<FormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            email: "",
            oldPassword: "",
            password: "",
            confirmPassword: "",
            inviteToken: "",
        },
    });

    const { mutate: changePassword, isPending: isLoading } = useChangePassword({
        onSuccess: () => {
            toast({
                title: "パスワードが変更されました",
                description: "ログイン情報が更新されました。",
            });
            form.reset({
                email: user?.email ?? "",
                oldPassword: "",
                password: "",
                confirmPassword: "",
                inviteToken: "",
            });
            setIsSettingsOpen(false);
        },
        onError: (error) => {
            toast({
                title: "エラーが発生しました",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    useEffect(() => {
        if (user?.email) {
            form.reset({ ...form.getValues(), email: user.email });
        }
    }, [user?.email]);

    useEffect(() => {
        if (!user) setLocation("/");
    }, [user, setLocation]);

    const passwordStrength = zxcvbn(form.watch("password") || "");
    const strengthPercent = (passwordStrength.score / 4) * 100;
    const strengthColor = [
        "bg-red-400",
        "bg-orange-400",
        "bg-yellow-400",
        "bg-green-500",
        "bg-emerald-600",
    ][passwordStrength.score];
    const strengthLabel = [
        "💔 とても弱い",
        "🧂 弱い",
        "🛡 普通",
        "💪 強い",
        "🦾 とても強い",
    ][passwordStrength.score];

    const onSubmit = (data: FormValues) => {
        changePassword({
            oldPassword: data.oldPassword,
            newPassword: data.password,
        });
    };

    return (
        <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <SheetContent className="w-full sm:w-80 flex flex-col h-full bg-noble-black-900 backdrop-blur-2xl">
                <SheetHeader className="p-6 space-y-5 h-full relative">
                    <SheetTitle className="text-2xl text-center text-noble-black-100">設定</SheetTitle>
                    <SheetDescription>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* Email */}
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-noble-black-100 flex items-center gap-1">
                                                <Heart className="h-3 w-3" /> メールアドレス
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="email"
                                                    {...field}
                                                    value={field.value}
                                                    readOnly
                                                    className="border-noble-black-900 bg-black   border backdrop-blur-sm text-noble-black-100"
                                                />
                                            </FormControl>
                                            <FormMessage className="text-red-400" />
                                        </FormItem>
                                    )}
                                />

                                {/* Old Password */}
                                <FormField
                                    control={form.control}
                                    name="oldPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-noble-black-100 flex items-center gap-1">
                                                <Star className="h-3 w-3" /> 現在のパスワード
                                            </FormLabel>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    {...field}
                                                    className="border-noble-black-900 bg-black  text-noble-black-100 border backdrop-blur-sm pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((prev) => !prev)}
                                                    className="absolute inset-y-0 right-2 flex items-center text-noble-black-100"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <FormMessage className="text-red-400" />
                                        </FormItem>
                                    )}
                                />

                                {/* New Password */}
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-noble-black-100 flex items-center gap-1">
                                                <Star className="h-3 w-3" /> 新しいパスワード
                                            </FormLabel>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    {...field}
                                                    className="border-noble-black-900 bg-black  text-noble-black-100 border backdrop-blur-sm pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((p) => !p)}
                                                    className="absolute inset-y-0 right-2 flex items-center text-noble-black-100"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>

                                            {/* Strength Meter */}
                                            <div className="mt-2">
                                                <div className="h-2 w-full bg-black rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${strengthColor}`}
                                                        style={{ width: `${strengthPercent}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-noble-black-100 mt-1">{strengthLabel}</p>
                                            </div>

                                            <FormMessage className="text-red-400" />
                                        </FormItem>
                                    )}
                                />

                                {/* Confirm Password */}
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-noble-black-100 flex items-center gap-1">
                                                <Star className="h-3 w-3" /> 確認用パスワード
                                            </FormLabel>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    {...field}
                                                    className="border-noble-black-900 bg-black  text-noble-black-100 border backdrop-blur-sm pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((p) => !p)}
                                                    className="absolute inset-y-0 right-2 flex items-center text-noble-black-100"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <FormMessage className="text-red-400" />
                                        </FormItem>
                                    )}
                                />

                                {/* Submit */}
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                >
                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-black  hover:from-violet-500 hover:to-violet-600 text-noble-black-100 hover:text-noble-black-100 font-medium rounded-xl shadow-md relative"
                                    >
                                        {isLoading ? "変更中…" : "変更"}
                                        <motion.span
                                            className="absolute -top-1 -right-1 text-xs pointer-events-none"
                                            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                                            transition={{ duration: 3, repeat: Infinity }}
                                        >
                                            <Zap className="h-3 w-3 text-noble-black-100" />
                                        </motion.span>
                                        <motion.span
                                            className="absolute -bottom-1 -left-1 text-xs pointer-events-none"
                                            animate={{ rotate: -360, scale: [1, 1.2, 1] }}
                                            transition={{ duration: 3, repeat: Infinity }}
                                        >
                                            <Zap className="h-3 w-3 text-noble-black-100" />
                                        </motion.span>
                                    </Button>
                                </motion.div>
                            </form>
                        </Form>
                    </SheetDescription>

                    {/* ✅ Loading Overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-black backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
                            <Trio
                                size="40"
                                speed="1.3"
                                color="#f2f2f2"
                            />
                            <span className="text-noble-black-100 animate-pulse font-semibold">変更を保存中…</span>
                        </div>
                    )}
                </SheetHeader>
            </SheetContent>
        </Sheet>
    );
};

export default Settings;
