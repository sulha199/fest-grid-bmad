'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReextractPreviewResult } from './reextract-preview-result';
import { usePostReextractionPreview } from './use-post-reextraction-preview';

interface ReextractPostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

/** AD-36 -- runs the re-extract preview for one stored post when opened. Moderator-only caller. */
export function ReextractPostDialog({ isOpen, onClose, postId }: ReextractPostDialogProps) {
  const t = useTranslations('ReextractPreview');
  const { start, reset, phase, preview, errorMessage } = usePostReextractionPreview();

  useEffect(() => {
    if (isOpen) {
      void start({ postId });
    } else {
      reset();
    }
    // `start`/`reset` are stable for the lifetime of the dialog; re-run only on open/post change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, postId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>

        {(phase === 'starting' || phase === 'running') && (
          <div className="py-6" role="status">
            <p className="py-4 text-center text-sm text-muted-foreground">{t('running')}</p>
          </div>
        )}

        {phase === 'failed' && (
          <div className="space-y-3" role="alert">
            <p className="text-sm text-destructive">{errorMessage || t('genericError')}</p>
            <Button variant="outline" onClick={() => void start({ postId })}>
              {t('retry')}
            </Button>
          </div>
        )}

        {phase === 'done' && preview && <ReextractPreviewResult preview={preview} />}
      </DialogContent>
    </Dialog>
  );
}
