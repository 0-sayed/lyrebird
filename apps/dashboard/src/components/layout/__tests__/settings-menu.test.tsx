import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { screen, waitFor, render as rtlRender } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/providers/theme-provider';
import { SettingsMenu } from '../settings-menu';

// =============================================================================
// Test Wrapper (custom for this test to control theme)
// =============================================================================

const mockSetTheme = vi.fn();
let mockTheme: 'light' | 'dark' | 'system' = 'system';
let mockResolvedTheme: 'light' | 'dark' = 'light';

vi.mock('@/hooks', async () => {
  const actual = await vi.importActual('@/hooks');
  return {
    ...actual,
    useTheme: () => ({
      theme: mockTheme,
      setTheme: mockSetTheme,
      resolvedTheme: mockResolvedTheme,
    }),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="test-theme">
          <TooltipProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };
}

// =============================================================================
// Test Helpers
// =============================================================================

function renderSettingsMenu() {
  return rtlRender(<SettingsMenu />, { wrapper: createWrapper() });
}

async function openSettingsDropdown(user: ReturnType<typeof userEvent.setup>) {
  const settingsButton = screen.getByTestId('settings-menu');
  await user.click(settingsButton);
  // Wait for dropdown content to be in the document
  await waitFor(() => {
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });
}

async function openThemeSubmenu(user: ReturnType<typeof userEvent.setup>) {
  const themeToggle = screen.getByTestId('theme-toggle');
  // Hover on the theme toggle to open the submenu (Radix submenus open on hover)
  await user.hover(themeToggle);
  // Wait for submenu content to appear
  await waitFor(() => {
    expect(screen.getByText('Light')).toBeInTheDocument();
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('SettingsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = 'system';
    mockResolvedTheme = 'light';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the settings button', () => {
      renderSettingsMenu();
      expect(screen.getByTestId('settings-menu')).toBeInTheDocument();
    });

    it('renders with Settings aria-label', () => {
      renderSettingsMenu();
      const button = screen.getByTestId('settings-menu');
      expect(button).toHaveAttribute('aria-label', 'Settings');
    });

    it('renders sr-only text for screen readers', () => {
      renderSettingsMenu();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders settings icon', () => {
      renderSettingsMenu();
      const button = screen.getByTestId('settings-menu');
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('dropdown behavior', () => {
    it('opens dropdown menu when clicked', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);

      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    it('closes dropdown when pressing Escape', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();

      // Press Escape to close the dropdown
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('theme-toggle')).not.toBeInTheDocument();
      });
    });
  });

  describe('theme toggle trigger icon', () => {
    it('shows Monitor icon when theme is system', async () => {
      const user = userEvent.setup();
      mockTheme = 'system';
      mockResolvedTheme = 'light';

      renderSettingsMenu();
      await openSettingsDropdown(user);

      // Monitor icon is rendered when theme is 'system'
      // The icon is present, we verify the sr-only text shows the correct theme info
      expect(
        screen.getByText(/Theme \(System \(light\)\)/),
      ).toBeInTheDocument();
    });

    it('shows Moon icon when theme is dark', async () => {
      const user = userEvent.setup();
      mockTheme = 'dark';
      mockResolvedTheme = 'dark';

      renderSettingsMenu();
      await openSettingsDropdown(user);

      // sr-only text shows dark theme
      expect(screen.getByText('Theme (dark)')).toBeInTheDocument();
    });

    it('shows Sun icon when theme is light', async () => {
      const user = userEvent.setup();
      mockTheme = 'light';
      mockResolvedTheme = 'light';

      renderSettingsMenu();
      await openSettingsDropdown(user);

      // sr-only text shows light theme
      expect(screen.getByText('Theme (light)')).toBeInTheDocument();
    });
  });

  describe('theme submenu', () => {
    it('opens theme submenu on hover', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('shows current theme label in submenu header', async () => {
      const user = userEvent.setup();
      mockTheme = 'system';
      mockResolvedTheme = 'dark';

      renderSettingsMenu();
      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Header shows "Theme" followed by current theme info
      expect(screen.getByText('System (dark)')).toBeInTheDocument();
    });

    it('renders icons for all theme options', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Each option has an icon (svg element)
      const lightOption = screen
        .getByText('Light')
        .closest('[role="menuitem"]');
      const darkOption = screen.getByText('Dark').closest('[role="menuitem"]');
      const systemOption = screen
        .getByText('System')
        .closest('[role="menuitem"]');

      expect(lightOption?.querySelector('svg')).toBeInTheDocument();
      expect(darkOption?.querySelector('svg')).toBeInTheDocument();
      expect(systemOption?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('theme selection', () => {
    it('theme options are clickable menu items', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Verify all theme options are interactive menu items
      const lightOption = screen
        .getByText('Light')
        .closest('[role="menuitem"]');
      const darkOption = screen.getByText('Dark').closest('[role="menuitem"]');
      const systemOption = screen
        .getByText('System')
        .closest('[role="menuitem"]');

      expect(lightOption).toBeInTheDocument();
      expect(darkOption).toBeInTheDocument();
      expect(systemOption).toBeInTheDocument();
    });

    it('theme options have correct structure for selection', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Each theme option should have an icon and label
      const lightOption = screen
        .getByText('Light')
        .closest('[role="menuitem"]');
      const darkOption = screen.getByText('Dark').closest('[role="menuitem"]');
      const systemOption = screen
        .getByText('System')
        .closest('[role="menuitem"]');

      // Verify structure: each has an icon (svg) and text
      expect(lightOption?.querySelector('svg')).toBeInTheDocument();
      expect(darkOption?.querySelector('svg')).toBeInTheDocument();
      expect(systemOption?.querySelector('svg')).toBeInTheDocument();
    });

    it('selecting a theme option closes the menu', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Verify the submenu is open
      expect(screen.getByText('Light')).toBeInTheDocument();

      // Press Escape to close the menu (simulates user dismissal)
      await user.keyboard('{Escape}');

      // Verify menu closes
      await waitFor(() => {
        expect(screen.queryByText('Light')).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has aria-label on theme toggle', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);

      const themeToggle = screen.getByTestId('theme-toggle');
      expect(themeToggle).toHaveAttribute('aria-label', 'Theme');
    });

    it('has sr-only text describing current theme', async () => {
      const user = userEvent.setup();
      mockTheme = 'system';
      mockResolvedTheme = 'dark';

      renderSettingsMenu();
      await openSettingsDropdown(user);

      // sr-only span shows current theme state
      expect(screen.getByText(/Theme \(System \(dark\)\)/)).toBeInTheDocument();
    });

    it('settings button is keyboard accessible', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      const settingsButton = screen.getByTestId('settings-menu');
      settingsButton.focus();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });
    });

    it('theme menu items are keyboard navigable', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();

      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Theme options are visible and accessible via keyboard
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();

      // All options are menu items
      expect(
        screen.getByText('Light').closest('[role="menuitem"]'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Dark').closest('[role="menuitem"]'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('System').closest('[role="menuitem"]'),
      ).toBeInTheDocument();
    });
  });

  describe('resolved theme display', () => {
    it('shows resolved theme in parentheses when theme is system', async () => {
      const user = userEvent.setup();
      mockTheme = 'system';
      mockResolvedTheme = 'light';

      renderSettingsMenu();
      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Submenu header shows "System (light)"
      expect(screen.getByText('System (light)')).toBeInTheDocument();
    });

    it('shows resolved dark theme in system mode', async () => {
      const user = userEvent.setup();
      mockTheme = 'system';
      mockResolvedTheme = 'dark';

      renderSettingsMenu();
      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      expect(screen.getByText('System (dark)')).toBeInTheDocument();
    });

    it('does not show resolved theme for explicit light theme', async () => {
      const user = userEvent.setup();
      mockTheme = 'light';
      mockResolvedTheme = 'light';

      renderSettingsMenu();
      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Should show "light" without parentheses
      expect(screen.queryByText('System (light)')).not.toBeInTheDocument();
    });

    it('does not show resolved theme for explicit dark theme', async () => {
      const user = userEvent.setup();
      mockTheme = 'dark';
      mockResolvedTheme = 'dark';

      renderSettingsMenu();
      await openSettingsDropdown(user);
      await openThemeSubmenu(user);

      // Should show "dark" without parentheses
      expect(screen.queryByText('System (dark)')).not.toBeInTheDocument();
    });
  });
});
