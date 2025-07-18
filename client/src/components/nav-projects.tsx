import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { MouseEventHandler } from "react"
import { useRecoilValue } from "recoil"
import { activeTabState } from "@/states/activeTabState"

export function NavProjects({
  projects,
}: {
  projects: {
    name: string
    tag: string
    icon: LucideIcon
    click: () => void;
  }[]
}) {
  const { isMobile } = useSidebar()
  const activeTab = useRecoilValue(activeTabState)

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel className="text-noble-black-500">プロジェクト</SidebarGroupLabel>
      <SidebarMenu className="flex flex-col items-center justify-center text-noble-black-100">
        {projects.map((item) => (

          <SidebarMenuButton isActive={activeTab===item.tag} key={item.name} asChild>
            <div className="cursor-pointer" onClick={item.click}>
              <item.icon />
              <span>{item.name}</span>
            </div>
          </SidebarMenuButton>

        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
