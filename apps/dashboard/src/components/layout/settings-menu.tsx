import { Check, Monitor, Moon, Settings, Sun } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { useTheme } from '@/hooks';
import { cn } from '@/lib/utils';

/**
 * Settings menu with nested theme submenu (Gemini-style)
 * - Gear icon opens settings popup
 * - Theme option reveals submenu on hover with Light/Dark/System choices
 */
export function SettingsMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const ThemeTriggerIcon =
    theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          aria-label="Settings"
          className="aspect-square w-9 justify-center rounded-full p-0"
        >
          <Settings className="h-7 w-7" />
          <span className="sr-only">Settings</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-0 p-1">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            aria-label="Theme"
            className={cn(
              'h-9 w-9 justify-center rounded-md px-0 py-0 cursor-pointer',
              // The SubTrigger component always appends a ChevronRight; hide it
              // so this feels like an icon-only control.
              '[&>svg:last-child]:hidden',
            )}
          >
            <ThemeTriggerIcon className="h-4 w-4" />
            <span className="sr-only">
              Theme ({theme === 'system' ? `System (${resolvedTheme})` : theme})
            </span>
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent className="w-44">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Theme
              <span className="ml-1 capitalize">
                {theme === 'system' ? `System (${resolvedTheme})` : theme}
              </span>
            </div>
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{label}</span>
                </div>
                {theme === value && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
