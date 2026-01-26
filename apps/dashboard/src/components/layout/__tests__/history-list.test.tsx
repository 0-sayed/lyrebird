import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { screen, waitFor, render as rtlRender } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/providers/theme-provider';
import { StatusIndicator, HistoryItem, HistoryList } from '../history-list';
import { JobStatus } from '@/types/api';
import type { JobResponse } from '@/types/api';

// =============================================================================
// Mocks
// =============================================================================

const mockMutate = vi.fn();
let mockJobsData: { jobs: JobResponse[] } | undefined = undefined;
let mockIsLoading = false;
let mockError: Error | null = null;
const mockRefetch = vi.fn();

vi.mock('@/hooks', async () => {
  const actual = await vi.importActual('@/hooks');
  return {
    ...actual,
    useJobs: () => ({
      data: mockJobsData,
      isLoading: mockIsLoading,
      error: mockError,
      refetch: mockRefetch,
    }),
    useDeleteJob: () => ({
      mutate: mockMutate,
    }),
  };
});

// =============================================================================
// Test Helpers
// =============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="test-theme">
          <TooltipProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };
}

function createMockJob(overrides: Partial<JobResponse> = {}): JobResponse {
  return {
    jobId: 'job-1',
    status: JobStatus.COMPLETED,
    prompt: 'Test analysis query',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderWithWrapper(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: createWrapper() });
}

// =============================================================================
// Tests: StatusIndicator
// =============================================================================

describe('StatusIndicator', () => {
  describe('rendering', () => {
    it('renders a span element', () => {
      const { container } = renderWithWrapper(
        <StatusIndicator status={JobStatus.COMPLETED} />,
      );
      expect(container.querySelector('span')).toBeInTheDocument();
    });
  });

  describe('title attribute', () => {
    it('shows "pending" as title for pending status', () => {
      const { container } = renderWithWrapper(
        <StatusIndicator status={JobStatus.PENDING} />,
      );
      expect(container.querySelector('span')).toHaveAttribute(
        'title',
        'pending',
      );
    });

    it('shows "in progress" as title for in_progress status (underscore replaced)', () => {
      const { container } = renderWithWrapper(
        <StatusIndicator status={JobStatus.IN_PROGRESS} />,
      );
      expect(container.querySelector('span')).toHaveAttribute(
        'title',
        'in progress',
      );
    });

    it('shows "completed" as title for completed status', () => {
      const { container } = renderWithWrapper(
        <StatusIndicator status={JobStatus.COMPLETED} />,
      );
      expect(container.querySelector('span')).toHaveAttribute(
        'title',
        'completed',
      );
    });

    it('shows "failed" as title for failed status', () => {
      const { container } = renderWithWrapper(
        <StatusIndicator status={JobStatus.FAILED} />,
      );
      expect(container.querySelector('span')).toHaveAttribute(
        'title',
        'failed',
      );
    });
  });
});

// =============================================================================
// Tests: HistoryItem
// =============================================================================

describe('HistoryItem', () => {
  const mockOnSelect = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the job prompt', () => {
      const job = createMockJob({ prompt: 'My test query' });
      renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );
      expect(screen.getByText('My test query')).toBeInTheDocument();
    });

    it('renders status indicator for the job', () => {
      const job = createMockJob({ status: JobStatus.IN_PROGRESS });
      const { container } = renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );
      // Check for the status indicator with animate-pulse (in_progress)
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('renders more options button with sr-only text', () => {
      const job = createMockJob();
      renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );
      expect(screen.getByText('More options')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('calls onSelect with jobId when clicked', async () => {
      const user = userEvent.setup();
      const job = createMockJob({
        jobId: 'test-job-123',
        prompt: 'Clickable job',
      });
      renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );

      await user.click(screen.getByText('Clickable job').closest('button')!);
      expect(mockOnSelect).toHaveBeenCalledWith('test-job-123');
    });

    it('applies active styling when isActive is true', () => {
      const job = createMockJob({ prompt: 'Active job' });
      renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={true}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );
      // The button should have data-active attribute
      const button = screen.getByText('Active job').closest('button');
      expect(button).toHaveAttribute('data-active', 'true');
    });
  });

  describe('dropdown menu', () => {
    it('opens dropdown when more options button is clicked', async () => {
      const user = userEvent.setup();
      const job = createMockJob();
      renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );

      const moreButton = screen.getByText('More options').closest('button')!;
      await user.click(moreButton);

      await waitFor(() => {
        expect(screen.getByText('Favorite')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('shows Favorite and Delete options in dropdown', async () => {
      const user = userEvent.setup();
      const job = createMockJob();
      renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );

      const moreButton = screen.getByText('More options').closest('button')!;
      await user.click(moreButton);

      await waitFor(() => {
        expect(screen.getByText('Favorite')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('calls onDelete with jobId when Delete is clicked', async () => {
      const user = userEvent.setup();
      const job = createMockJob({ jobId: 'delete-me-123' });
      renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );

      const moreButton = screen.getByText('More options').closest('button')!;
      await user.click(moreButton);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Delete'));
      expect(mockOnDelete).toHaveBeenCalledWith('delete-me-123');
    });
  });

  describe('tooltip', () => {
    it('button has tooltip attribute with job prompt', () => {
      const job = createMockJob({ prompt: 'Tooltip test prompt' });
      renderWithWrapper(
        <HistoryItem
          job={job}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />,
      );
      // SidebarMenuButton uses tooltip prop which sets data-tooltip attribute
      const button = screen.getByText('Tooltip test prompt').closest('button');
      expect(button).toBeInTheDocument();
    });
  });
});

// =============================================================================
// Tests: HistoryList
// =============================================================================

describe('HistoryList', () => {
  const mockOnSelectJob = vi.fn();
  const mockOnJobDeleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockJobsData = undefined;
    mockIsLoading = false;
    mockError = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders skeleton loaders when loading', () => {
      mockIsLoading = true;
      const { container } = renderWithWrapper(<HistoryList />);
      // Should render 5 skeleton elements
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(5);
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', () => {
      mockError = new Error('Network error');
      renderWithWrapper(<HistoryList />);
      expect(screen.getByText('Failed to load history')).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      mockError = new Error('Network error');
      renderWithWrapper(<HistoryList />);
      expect(
        screen.getByRole('button', { name: /retry/i }),
      ).toBeInTheDocument();
    });

    it('calls refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      mockError = new Error('Network error');
      renderWithWrapper(<HistoryList />);

      await user.click(screen.getByRole('button', { name: /retry/i }));
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no jobs exist', () => {
      mockJobsData = { jobs: [] };
      renderWithWrapper(<HistoryList />);
      // Text is split by <br/>, use a regex or substring match
      expect(screen.getByText(/No analysis history yet/)).toBeInTheDocument();
    });

    it('shows instructions to start new analysis', () => {
      mockJobsData = { jobs: [] };
      renderWithWrapper(<HistoryList />);
      // Text is split by <br/>, use a regex or substring match
      expect(
        screen.getByText(/Start a new analysis to see it here/),
      ).toBeInTheDocument();
    });
  });

  describe('with jobs', () => {
    it('renders list of jobs', () => {
      mockJobsData = {
        jobs: [
          createMockJob({ jobId: 'job-1', prompt: 'First query' }),
          createMockJob({ jobId: 'job-2', prompt: 'Second query' }),
        ],
      };
      renderWithWrapper(<HistoryList />);
      expect(screen.getByText('First query')).toBeInTheDocument();
      expect(screen.getByText('Second query')).toBeInTheDocument();
    });

    it('marks active job correctly', () => {
      mockJobsData = {
        jobs: [
          createMockJob({ jobId: 'job-1', prompt: 'Active job' }),
          createMockJob({ jobId: 'job-2', prompt: 'Inactive job' }),
        ],
      };
      renderWithWrapper(
        <HistoryList
          activeJobId="job-1"
          onSelectJob={mockOnSelectJob}
          onJobDeleted={mockOnJobDeleted}
        />,
      );
      const activeButton = screen.getByText('Active job').closest('button');
      expect(activeButton).toHaveAttribute('data-active', 'true');
    });

    it('calls onSelectJob when job is selected', async () => {
      const user = userEvent.setup();
      mockJobsData = {
        jobs: [createMockJob({ jobId: 'job-select', prompt: 'Clickable job' })],
      };
      renderWithWrapper(
        <HistoryList
          onSelectJob={mockOnSelectJob}
          onJobDeleted={mockOnJobDeleted}
        />,
      );

      await user.click(screen.getByText('Clickable job').closest('button')!);
      expect(mockOnSelectJob).toHaveBeenCalledWith('job-select');
    });

    it('handles delete job request', async () => {
      const user = userEvent.setup();
      mockJobsData = {
        jobs: [createMockJob({ jobId: 'job-delete', prompt: 'Delete me' })],
      };
      renderWithWrapper(
        <HistoryList
          onSelectJob={mockOnSelectJob}
          onJobDeleted={mockOnJobDeleted}
        />,
      );

      // Open dropdown
      const moreButton = screen.getByText('More options').closest('button')!;
      await user.click(moreButton);

      // Click delete
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Delete'));

      // Should call mutate with jobId
      expect(mockMutate).toHaveBeenCalledWith('job-delete', expect.any(Object));
    });

    it('calls onJobDeleted after successful delete of active job', async () => {
      const user = userEvent.setup();
      mockJobsData = {
        jobs: [
          createMockJob({
            jobId: 'active-job',
            prompt: 'Active job to delete',
          }),
        ],
      };

      // Mock mutate to call onSuccess callback
      mockMutate.mockImplementation(
        (_jobId: string, options: { onSuccess: () => void }) => {
          options.onSuccess();
        },
      );

      renderWithWrapper(
        <HistoryList
          activeJobId="active-job"
          onSelectJob={mockOnSelectJob}
          onJobDeleted={mockOnJobDeleted}
        />,
      );

      // Open dropdown and delete
      const moreButton = screen.getByText('More options').closest('button')!;
      await user.click(moreButton);
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Delete'));

      expect(mockOnJobDeleted).toHaveBeenCalledWith('active-job');
    });

    it('does not call onJobDeleted when deleting non-active job', async () => {
      const user = userEvent.setup();
      mockJobsData = {
        jobs: [
          createMockJob({ jobId: 'other-job', prompt: 'Other job to delete' }),
        ],
      };

      mockMutate.mockImplementation(
        (_jobId: string, options: { onSuccess: () => void }) => {
          options.onSuccess();
        },
      );

      renderWithWrapper(
        <HistoryList
          activeJobId="different-active-job"
          onSelectJob={mockOnSelectJob}
          onJobDeleted={mockOnJobDeleted}
        />,
      );

      const moreButton = screen.getByText('More options').closest('button')!;
      await user.click(moreButton);
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Delete'));

      expect(mockOnJobDeleted).not.toHaveBeenCalled();
    });
  });

  describe('optional callbacks', () => {
    it('renders without onSelectJob prop', () => {
      mockJobsData = {
        jobs: [createMockJob({ prompt: 'No callback job' })],
      };
      renderWithWrapper(<HistoryList />);
      expect(screen.getByText('No callback job')).toBeInTheDocument();
    });

    it('renders without onJobDeleted prop', () => {
      mockJobsData = {
        jobs: [createMockJob({ prompt: 'No delete callback job' })],
      };
      renderWithWrapper(<HistoryList />);
      expect(screen.getByText('No delete callback job')).toBeInTheDocument();
    });

    it('handles click when onSelectJob is undefined (uses noop)', async () => {
      const user = userEvent.setup();
      mockJobsData = {
        jobs: [createMockJob({ prompt: 'Clickable without callback' })],
      };
      renderWithWrapper(<HistoryList />);

      // Should not throw when clicking
      await user.click(
        screen.getByText('Clickable without callback').closest('button')!,
      );
    });
  });
});
