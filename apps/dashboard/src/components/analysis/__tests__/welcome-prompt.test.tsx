import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WelcomePrompt } from '../welcome-prompt';

describe('WelcomePrompt', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders welcome prompt with title and input', () => {
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    expect(
      screen.getByText('What would you like to analyze today?'),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        'Describe what sentiment you want to analyze...',
      ),
    ).toBeInTheDocument();
  });

  it('renders example prompts', () => {
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    expect(screen.getByText('iPhone 15 reviews')).toBeInTheDocument();
    expect(screen.getByText('Climate change debate')).toBeInTheDocument();
    expect(screen.getByText('Tesla stock opinions')).toBeInTheDocument();
    expect(screen.getByText('AI in healthcare')).toBeInTheDocument();
  });

  it('disables submit button when input is empty', () => {
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', {
      name: /start analysis/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('disables submit button when input contains only whitespace', async () => {
    const user = userEvent.setup();
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(
      'Describe what sentiment you want to analyze...',
    );
    await user.type(input, '   ');

    const submitButton = screen.getByRole('button', {
      name: /start analysis/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when input has text', async () => {
    const user = userEvent.setup();
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(
      'Describe what sentiment you want to analyze...',
    );
    await user.type(input, 'test query');

    const submitButton = screen.getByRole('button', {
      name: /start analysis/i,
    });
    expect(submitButton).toBeEnabled();
  });

  it('calls onSubmit with trimmed query when form is submitted', async () => {
    const user = userEvent.setup();
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(
      'Describe what sentiment you want to analyze...',
    );
    await user.type(input, '  iPhone 15 reviews  ');

    const submitButton = screen.getByRole('button', {
      name: /start analysis/i,
    });
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('iPhone 15 reviews');
  });

  it('submits on Enter key press', async () => {
    const user = userEvent.setup();
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(
      'Describe what sentiment you want to analyze...',
    );
    await user.type(input, 'test query{Enter}');

    expect(mockOnSubmit).toHaveBeenCalledWith('test query');
  });

  it('does not submit on Shift+Enter (allows multiline)', async () => {
    const user = userEvent.setup();
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(
      'Describe what sentiment you want to analyze...',
    );
    await user.type(input, 'line 1{Shift>}{Enter}{/Shift}line 2');

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('fills input when clicking example prompt', async () => {
    const user = userEvent.setup();
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    const exampleButton = screen.getByText('iPhone 15 reviews');
    await user.click(exampleButton);

    const input = screen.getByPlaceholderText(
      'Describe what sentiment you want to analyze...',
    );
    expect(input).toHaveValue('iPhone 15 reviews');
  });

  it('disables input and buttons when loading', () => {
    render(<WelcomePrompt onSubmit={mockOnSubmit} isLoading />);

    const input = screen.getByPlaceholderText(
      'Describe what sentiment you want to analyze...',
    );
    expect(input).toBeDisabled();

    const exampleButtons = screen.getAllByRole('button');
    exampleButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('has accessible label for the input', () => {
    render(<WelcomePrompt onSubmit={mockOnSubmit} />);

    expect(
      screen.getByLabelText('Enter your sentiment analysis prompt'),
    ).toBeInTheDocument();
  });
});
