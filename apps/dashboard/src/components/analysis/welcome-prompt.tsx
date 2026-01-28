import * as React from 'react';
import {
  Bird,
  ArrowRight,
  Sparkles,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WelcomePromptProps } from './types';

// =============================================================================
// Constants
// =============================================================================

const EXAMPLE_PROMPTS = [
  'iPhone 15 reviews',
  'Climate change debate',
  'Tesla stock opinions',
  'AI in healthcare',
];

const MIN_HEIGHT = 56;
const MAX_HEIGHT = 120;
const MAX_PROMPT_LENGTH = 500;

// =============================================================================
// Component
// =============================================================================

/**
 * Centered welcome prompt for initial state
 *
 * Features:
 * - Centered layout with Lyrebird branding
 * - Auto-resizing textarea
 * - Example prompt suggestions
 * - Fade-out animation when exiting
 */
export function WelcomePrompt({
  onSubmit,
  isLoading = false,
  isExiting = false,
  className,
}: WelcomePromptProps) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = React.useCallback((textarea: HTMLTextAreaElement) => {
    // Measure content height without letting the browser apply an intrinsic
    // height based on `rows` (which can cause a small one-time jump).
    textarea.style.height = '0px';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.max(MIN_HEIGHT, Math.min(scrollHeight, MAX_HEIGHT));
    textarea.style.height = `${newHeight}px`;
  }, []);

  const handleSubmit = React.useCallback(() => {
    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue.length > MAX_PROMPT_LENGTH || isLoading)
      return;
    onSubmit(trimmedValue);
  }, [value, isLoading, onSubmit]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value);
      resizeTextarea(event.target);
    },
    [resizeTextarea],
  );

  const handleExampleClick = React.useCallback((example: string) => {
    setValue(example);
    // Focus and submit
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const trimmedValue = value.trim();
  const canSubmit =
    trimmedValue.length > 0 &&
    trimmedValue.length <= MAX_PROMPT_LENGTH &&
    !isLoading;
  const isOverLimit = trimmedValue.length > MAX_PROMPT_LENGTH;

  // Auto-focus on mount and when becoming visible
  React.useEffect(() => {
    if (!isLoading && !isExiting) {
      // Timeout to ensure DOM is ready, animations complete, and focus is visible
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        // Ensure cursor is visible by also selecting the position
        if (textareaRef.current) {
          const length = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(length, length);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isExiting]);

  return (
    <div
      data-testid="welcome-prompt"
      className={cn(
        'flex flex-1 flex-col items-center justify-center px-4 py-8 transition-all duration-300 mb-52',
        isExiting && 'animate-prompt-fade-out',
        className,
      )}
    >
      {/* Logo and title */}
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Bird className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          What would you like to analyze today?
        </h1>
        <p className="max-w-md text-center text-muted-foreground">
          Describe a topic, keyword, or phrase to analyze sentiment from Bluesky
          posts
        </p>
      </div>

      {/* Prompt input */}
      <div className="w-full max-w-2xl">
        <div
          className={cn(
            'relative flex items-end gap-3 rounded-3xl border bg-muted/50 p-3 shadow-sm transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
            isLoading && 'opacity-70',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe what sentiment you want to analyze..."
            disabled={isLoading}
            maxLength={MAX_PROMPT_LENGTH + 50}
            className={cn(
              'flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base leading-relaxed',
              'outline-none focus:outline-none focus:ring-0',
              'placeholder:text-muted-foreground',
              'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent',
              'overflow-y-auto',
              'cursor-thick',
              isOverLimit && 'text-destructive',
            )}
            style={{
              height: `${MIN_HEIGHT}px`,
              maxHeight: `${MAX_HEIGHT}px`,
              minHeight: `${MIN_HEIGHT}px`,
            }}
            rows={1}
            aria-label="Enter your sentiment analysis prompt"
            aria-describedby="prompt-length-hint"
          />
          <div className="flex shrink-0 items-center self-end pb-0.5">
            <Button
              type="button"
              size="icon"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              aria-label="Start analysis"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Character count indicator - always rendered to prevent layout shift */}
        <p
          id="prompt-length-hint"
          className={cn(
            'mt-2 text-right text-xs',
            trimmedValue.length > 0
              ? isOverLimit
                ? 'text-destructive'
                : 'text-muted-foreground'
              : 'invisible',
          )}
        >
          {trimmedValue.length}/{MAX_PROMPT_LENGTH}
        </p>

        {/* Example prompts */}
        <div className="mt-6">
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Try these examples:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => handleExampleClick(example)}
                disabled={isLoading}
                className={cn(
                  'rounded-full border bg-muted/50 px-4 py-2 text-sm transition-colors',
                  'hover:bg-muted hover:border-border',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Feature hints */}
        <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3 mx-auto">
          <FeatureHint
            icon={<Sparkles className="h-4 w-4" />}
            text="Real-time analysis"
          />
          <FeatureHint
            icon={<TrendingUp className="h-4 w-4" />}
            text="Sentiment trends"
          />
          <FeatureHint
            icon={<MessageSquare className="h-4 w-4" />}
            text="Post exploration"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Small feature hint component
 */
function FeatureHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <span className="text-primary">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
