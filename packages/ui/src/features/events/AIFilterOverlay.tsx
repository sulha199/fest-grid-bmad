import * as React from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '../../core/ui/button';

export interface AIFilterOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  error?: string | null;
  labels: {
    title: string;
    description: string;
    placeholder: string;
    submit: string;
    cancel: string;
    errorTitle?: string;
  };
}

export function AIFilterOverlay({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error,
  labels,
}: AIFilterOverlayProps) {
  const [prompt, setPrompt] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setTimeout(() => textareaRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const container = overlayRef.current;
    if (!container) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
      );
      const elements = Array.from(focusable).filter(el => el.tabIndex !== -1);
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === container) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleFocusTrap);
    return () => container.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) onSubmit(prompt.trim());
  };

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-overlay-title"
      className="fixed inset-0 z-50 flex flex-col bg-background p-6 md:p-10 outline-none"
    >
      <div className="mx-auto w-full max-w-3xl flex flex-col h-full justify-between">
        <div className="flex justify-end mb-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full shrink-0"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full gap-6">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-950/40 rounded-full text-blue-600 dark:text-blue-400 mb-2">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 id="ai-overlay-title" className="text-3xl font-extrabold tracking-tight">
              {labels.title}
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {labels.description}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={labels.placeholder}
              rows={4}
              disabled={isLoading}
              className="w-full p-4 text-base rounded-xl border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 resize-none shadow-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            {error && (
              <div role="alert" className="text-sm font-medium text-destructive mt-1 p-3 bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 h-11"
            >
              {labels.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="w-full sm:w-auto px-6 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{labels.submit}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
