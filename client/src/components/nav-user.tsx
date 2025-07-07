"use client"

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Settings,
  Sparkles,
  SquareActivity,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useState } from "react"
import { useRecoilState } from "recoil"
import { settingsStateAtom } from "@/states/settingsState"
import FeedbackDialog from "./feedback-dialog"
import { useAuth } from "@/hooks/use-auth";

export function NavUser({
  name, email, avatar
}: {
  name: string
  email: string
  avatar: string
}) {
  const { isMobile } = useSidebar()
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [_, setIsSettingsOpen] = useRecoilState(settingsStateAtom);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { logoutMutation } = useAuth();


  const handleOpenSheet = () => {

    setIsSettingsOpen(true);
    // setIsSidebarOpen(false)
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground text-noble-black-100 hover:text-noble-black-900"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-lg text-noble-black-100 bg-black capitalize text-center flex items-center justify-center ">{avatar}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight ">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 " />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-noble-black-900 border border-noble-black-800 text-noble-black-100 shadow-2xl"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg text-black">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="rounded-lg text-noble-black-100 bg-black capitalize text-center flex items-center justify-center ">{avatar}</AvatarFallback>

                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight text-noble-black-100">
                    <span className="truncate font-semibold">{name}</span>
                    <span className="truncate text-xs text-noble-black-600">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-noble-black-800/50" />

              <DropdownMenuGroup>

                <DropdownMenuItem onClick={() => setShowFeedbackDialog(true)} className="cursor-pointer hover:bg-noble-black-100 hover:text-noble-black-900">
                  <SquareActivity />
                  フィードバック
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenSheet} className="cursor-pointer hover:bg-noble-black-100 hover:text-noble-black-900">
                  <Settings />
                  設定
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-noble-black-800/50" />
              <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} className="cursor-pointer hover:bg-noble-black-100 hover:text-noble-black-900">
                <LogOut />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>


      </SidebarMenu>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="mx-auto max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-blue-100">ログアウトしますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300/70">
              ログアウトすると、セッションが終了します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-blue-200 border-slate-700 hover:bg-slate-700">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => logoutMutation.mutate()}
              className="bg-red-900/50 hover:bg-red-900 text-red-50 border border-red-800"
            >
              ログアウト
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <FeedbackDialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog} />
    </>
  )
}
