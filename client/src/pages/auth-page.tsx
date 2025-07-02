import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { insertUserSchema, loginUserSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2, Shield, Network, Zap, Cpu, Server, Globe, Database, Key, EyeOff, Eye, Ticket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import zxcvbn from "zxcvbn";
import TurnstileWidget, { TurnstileWidgetHandle } from "@/components/TurnstileWidget";


// Futuristic tech symbols for the login page
const techSymbols = [
  "⦿", "◉", "◎", "◈", "⊡", "⊠", "⊞", "⧫",
  "◬", "⬢", "⬡", "⏣", "⌘", "⍟", "⎔", "⌬"
];

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const [currentSymbol, setCurrentSymbol] = useState(techSymbols[0]);
  const [particleCount, setParticleCount] = useState(0);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const { toast } = useToast();

  // Periodically change the tech symbol
  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * techSymbols.length);
      setCurrentSymbol(techSymbols[randomIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const form = useForm({
    resolver: zodResolver(isLogin ? loginUserSchema : insertUserSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      inviteToken: "",
    },
  });

  const passwordStrength = zxcvbn(form.watch("password") || "");
  const strengthPercent = (passwordStrength.score / 4) * 100;
  const strengthColor = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-500", "bg-emerald-600"][passwordStrength.score];
  const strengthLabel = [
    "💔 とても弱い",
    "🧂 弱い",
    "🛡 普通",
    "💪 強い",
    "🦾 とても強い"
  ][passwordStrength.score];

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // This creates a "tech particle" effect when the user clicks the logo
  const addTechParticles = () => {
    setParticleCount(prevCount => Math.min(prevCount + 1, 30));
    // Reset particles after 30 clicks
    if (particleCount >= 29) {
      setTimeout(() => setParticleCount(0), 500);
    }
  };

  const handleManualReset = () => {
    console.log("Manual reset - turnstile ref:", turnstileRef.current);
    if (turnstileRef.current) {
      turnstileRef.current.reset();
      setCaptcha(null);
      console.log("Manual reset completed");
    } else {
      console.error("Cannot reset - turnstile ref is null");
    }
  };

  if (!user) {
    const onSubmit = form.handleSubmit(async (data) => {
      // if (!captcha) return alert("Please solve the CAPTCHA");
      // if (isLogin) {
      //   const { email, password } = data;
      //   await loginMutation.mutateAsync({ email, password, turnstileToken: captcha });
      // } else {
      //   await registerMutation.mutateAsync({ ...data, turnstileToken: captcha });
      // }

      // turnstileRef.current?.reset();
      // setCaptcha(null);

      if (!captcha) {
        toast({
          title: "ログイン成功",
          description: "ようこそ！桜AIがあなたをお待ちしていました。",
        });
        return;
      }

      console.log("Before mutation - captcha:", captcha);
      console.log("Turnstile ref:", turnstileRef.current);

      try {
        if (isLogin) {
          const { email, password } = data;
          await loginMutation.mutateAsync({ email, password, turnstileToken: captcha });
        } else {
          await registerMutation.mutateAsync({ ...data, turnstileToken: captcha });
        }

        console.log("Success - about to reset captcha");

        // Try multiple reset approaches
        if (turnstileRef.current) {
          console.log("Calling reset...");
          turnstileRef.current.reset();
          setCaptcha(null);
          console.log("Reset called, captcha cleared");
        } else {
          console.error("Turnstile ref is null!");
        }

      } catch (error) {
        console.log("Error - about to reset captcha");

        if (turnstileRef.current) {
          console.log("Calling reset on error...");
          turnstileRef.current.reset();
          setCaptcha(null);
          console.log("Reset called on error, captcha cleared");
        } else {
          console.error("Turnstile ref is null on error!");
        }

        console.error('Authentication failed:', error);
      }
    });



    return (
      <div className="min-h-screen flex flex-col md:grid md:grid-cols-2 overflow-hidden">
        {/* Floating tech particles */}
        <AnimatePresence>
          {Array.from({ length: particleCount }).map((_, index) => (
            <motion.div
              key={`particle-${index}`}
              className="fixed text-xl z-10 pointer-events-none"
              initial={{
                top: "10%",
                left: "50%",
                opacity: 0,
                scale: 0.5,
                rotate: 0
              }}
              animate={{
                top: ["10%", "90%"],
                left: [`${50 + (Math.random() * 30 - 15)}%`, `${50 + (Math.random() * 40 - 20)}%`],
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1, 0.8],
                rotate: [0, 180, 360]
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 4 + Math.random() * 3,
                ease: "easeInOut"
              }}
            >
              {Math.random() > 0.5 ?
                <Zap size={24} className="text-blue-400" /> :
                <Network size={24} className="text-blue-500" />
              }
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Bot Logo in Mobile View */}
        <motion.div
          className="flex-1 md:flex-none flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-900 to-blue-900 md:hidden"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <img
            src="/images/mirai.png"
            alt="Bot Logo"
            className="w-32 h-32 object-cover rounded-full"
          />
          <div className="relative flex items-center justify-center">
            {/* Your main text with shimmer */}
            <motion.span
              className="text-3xl font-bold text-blue-300 font-mono relative z-10"
              animate={{
                textShadow: [
                  "0 0 3px rgba(59, 130, 246, 0.5)",
                  "0 0 7px rgba(59, 130, 246, 0.8)",
                  "0 0 3px rgba(59, 130, 246, 0.5)"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              ミライ
            </motion.span>

            {/* Decorative rotating ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-blue-500/30 border-t-blue-500/80 shadow-lg shadow-blue-500/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>

        {/* Authentication Card */}
        <motion.div
          className="flex-1 md:flex-none flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-900 to-blue-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Hide the rotating Server icon on mobile */}
          <div className="hidden md:flex flex-col items-center">
            <motion.div
              className="w-32 h-32 mb-6 flex items-center justify-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="relative w-full h-full"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute w-full h-full rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                </div>
                <div className="absolute inset-2 flex items-center justify-center">
                  <div className="absolute w-full h-full rounded-full border-2 border-blue-500/30 border-l-blue-500" />
                </div>
                <div className="absolute inset-4 flex items-center justify-center">
                  <div className="absolute w-full h-full rounded-full border-2 border-blue-600/30 border-r-blue-600" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Server size={30} className="text-blue-400" />
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Rest of the form content (always shown) */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.3
            }}
            className="w-full max-w-md"
          >
            <Card className="p-8 bg-slate-800/90 backdrop-blur-sm border border-blue-500/20 shadow-lg rounded-xl">
              <div className="flex items-center justify-between mb-6">
                <motion.h1
                  className="text-2xl font-bold text-blue-400 font-mono"
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                >
                  {isLogin ? "ログイン" : "新規アカウント"}
                </motion.h1>
                <motion.div
                  className="text-2xl text-blue-300"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, repeatType: "reverse" }}
                >
                  {currentSymbol}
                </motion.div>
              </div>

              <Form {...form}>
                <form onSubmit={onSubmit} className="space-y-4">
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-blue-300 flex items-center gap-1">
                            <Database className="h-3 w-3" /> メールアドレス
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              {...field}
                              className="border-blue-500/30 focus:border-blue-400 bg-slate-900/80 backdrop-blur-sm text-white"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-blue-300 flex items-center gap-1">
                            <Key className="h-3 w-3" /> パスワード
                          </FormLabel>
                          <FormControl>

                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                {...field}
                                className="border-blue-500/30 focus:border-blue-400 bg-slate-900/80 backdrop-blur-sm text-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className="absolute inset-y-0 right-2 flex items-center text-pink-600"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>


                          {/* Password Strength */}
                          {!isLogin && (
                            <>
                              <div className="mt-2">
                                <div className="h-2 w-full bg-pink-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${strengthColor}`}
                                    style={{ width: `${strengthPercent}%` }}
                                  />
                                </div>
                                <p className="text-xs text-pink-700 mt-1">{strengthLabel}</p>
                              </div>
                            </>
                          )}

                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </motion.div>


                  {!isLogin && (
                    <>
                      {/* Confirm Password */}
                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-blue-700">パスワード（確認）</FormLabel>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                {...field}
                                className="border-blue-500/30 focus:border-blue-400 bg-slate-900/80 backdrop-blur-sm text-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(prev => !prev)}
                                className="absolute inset-y-0 right-2 flex items-center text-blue-600"
                              >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      {/* Invite Token */}
                      <FormField
                        control={form.control}
                        name="inviteToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-blue-700 flex items-center gap-1">
                              <Ticket className="h-3 w-3" /> 招待トークン（任意）
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                {...field}
                                className="border-blue-500/30 focus:border-blue-400 bg-slate-900/80 backdrop-blur-sm text-white"
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  <TurnstileWidget ref={turnstileRef} onToken={setCaptcha} />
                  {/* <button type="button" onClick={handleManualReset}>
                    Manual Reset (Debug)
                  </button> */}

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    whileHover={{ scale: 1.03 }}
                  >
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-md shadow-lg shadow-blue-700/30 relative"
                      disabled={loginMutation.isPending || registerMutation.isPending || !captcha}
                    >
                      {loginMutation.isPending || registerMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isLogin ? (
                        "ログイン"
                      ) : (
                        "アカウントを作成"
                      )}

                      {/* Decorative elements on button */}
                      <motion.span
                        className="absolute -top-1 -right-1 text-blue-300 pointer-events-none"
                        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        <Zap size={14} />
                      </motion.span>
                      <motion.span
                        className="absolute -bottom-1 -left-1 text-blue-300 pointer-events-none"
                        animate={{ rotate: -360, scale: [1, 1.2, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        <Shield size={14} />
                      </motion.span>
                    </Button>
                  </motion.div>
                </form>
              </Form>

              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Button
                  variant="link"
                  onClick={() => setIsLogin(!isLogin)}
                  className="w-full text-sm text-blue-400 hover:text-blue-300"
                >
                  {isLogin ? "アカウントが必要ですか？ サインアップ" : "すでにアカウントをお持ちですか？ ログイン"}
                </Button>

              </motion.div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Branding Section (Hidden in Mobile) */}
        <motion.div
          className="hidden md:flex flex-col justify-center items-center p-8 bg-gradient-to-b from-blue-900 to-slate-900 relative overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {/* Futuristic tech background elements */}
          {Array.from({ length: 6 }).map((_, index) => (
            <motion.div
              key={`deco-${index}`}
              className="absolute text-blue-400/20 opacity-20 pointer-events-none"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
              animate={{
                rotate: Math.random() > 0.5 ? 360 : -360,
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 10 + Math.random() * 10,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              {[
                <Server size={40} key="server" />,
                <Cpu size={40} key="cpu" />,
                <Database size={40} key="database" />,
                <Globe size={40} key="globe" />,
                <Network size={40} key="network" />,
                <Shield size={40} key="shield" />
              ][index]}
            </motion.div>
          ))}

          <motion.div
            className="w-48 h-48 mb-8 cursor-pointer z-10 relative"
            whileHover={{ scale: 1.05, rotate: [0, -3, 3, 0] }}
            whileTap={{ scale: 0.95 }}
            onClick={addTechParticles}
          >
            {/* Animated tech logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="absolute w-full h-full rounded-full border-4 border-blue-400/20 border-t-blue-500"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute w-3/4 h-3/4 rounded-full border-4 border-blue-500/20 border-l-blue-400"
                animate={{ rotate: [360, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute w-1/2 h-1/2 rounded-full border-4 border-blue-600/20 border-r-blue-600"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="text-6xl font-mono text-blue-400"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.8, 1, 0.8],
                  textShadow: [
                    "0 0 5px rgba(59, 130, 246, 0.5)",
                    "0 0 20px rgba(59, 130, 246, 0.8)",
                    "0 0 5px rgba(59, 130, 246, 0.5)"
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <img
                  src="/images/mirai.png"
                  alt="Bot Logo"
                  className="w-18 h-18 object-contain rounded-full"
                />
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            className="max-w-md text-center bg-slate-800/40 backdrop-blur-md p-6 rounded-xl border border-blue-500/20 shadow-lg z-10"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <motion.div
              className="flex items-center justify-center mb-4 gap-2"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            >

              <span className="text-2xl font-bold text-blue-300 font-mono">ミライ</span>
            </motion.div>
            <motion.p
              className="text-lg text-blue-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              FSDのAIアシスタント
            </motion.p>
            <motion.p
              className="text-sm text-blue-300 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Future Services Development
            </motion.p>
          </motion.div>

          {/* Circuit-like pattern background */}
          <div className="absolute inset-0 z-0 opacity-10">
            <div className="absolute top-1/4 left-1/4 w-1/2 h-px bg-blue-400" />
            <div className="absolute top-1/2 left-1/6 w-2/3 h-px bg-blue-400" />
            <div className="absolute top-3/4 left-1/3 w-1/3 h-px bg-blue-400" />
            <div className="absolute top-1/6 left-1/2 w-px h-2/3 bg-blue-400" />
            <div className="absolute top-1/4 left-2/3 w-px h-1/2 bg-blue-400" />
            <div className="absolute top-1/3 left-1/3 w-px h-1/3 bg-blue-400" />

            <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-blue-400" />
            <div className="absolute top-1/2 left-1/6 w-2 h-2 rounded-full bg-blue-400" />
            <div className="absolute top-3/4 left-1/3 w-2 h-2 rounded-full bg-blue-400" />
            <div className="absolute top-1/6 left-1/2 w-2 h-2 rounded-full bg-blue-400" />
            <div className="absolute top-1/4 left-2/3 w-2 h-2 rounded-full bg-blue-400" />
            <div className="absolute top-1/3 left-1/3 w-2 h-2 rounded-full bg-blue-400" />
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}