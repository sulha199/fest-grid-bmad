"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { EventImage } from './EventImage';
import { InstagramEmbedProps } from './InstagramEmbed.types';

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
  }
}

const INSTAGRAM_EMBED_SCRIPT_SRC = '//www.instagram.com/embed.js';
const INSTAGRAM_EMBED_SCRIPT_SELECTOR = 'script[src*="instagram.com/embed.js"]';

// There is no reliable "embed ready" DOM event exposed by Instagram's embed.js widget --
// it either replaces the injected <blockquote class="instagram-media"> with a real
// <iframe> once it finishes rendering, or silently does nothing if it fails. We treat the
// iframe's appearance (observed via MutationObserver) as the "ready" signal, and fall back
// to revealing the content after a fixed timeout so a slow/broken script load never leaves
// the skeleton showing forever (this is a documented implementation judgment call, not a
// spec'd behavior -- see Story 3.7d Dev Agent Record).
const EMBED_READY_FALLBACK_TIMEOUT_MS = 4000;

/**
 * Idempotently ensures Instagram's embed.js widget script is present on the page (once per
 * page, guarded against duplicate injection across multiple embeds/navigations), then invokes
 * the provided callback once the script is known to be loaded/available.
 */
function loadInstagramEmbedScript(onReady: () => void): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (window.instgrm?.Embeds) {
    onReady();
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(INSTAGRAM_EMBED_SCRIPT_SELECTOR);
  if (existingScript) {
    existingScript.addEventListener('load', onReady, { once: true });
    // The script may have already finished loading before this listener was attached.
    if (window.instgrm?.Embeds) {
      onReady();
    }
    return;
  }

  const script = document.createElement('script');
  script.src = INSTAGRAM_EMBED_SCRIPT_SRC;
  script.async = true;
  script.addEventListener('load', onReady, { once: true });
  script.addEventListener('error', () => {
    // Defensive: a failed script load must not throw or crash the page -- the loading
    // state's fallback timeout will still reveal the (unrendered) embed markup.
  }, { once: true });
  document.body.appendChild(script);
}

export const InstagramEmbed: React.FC<InstagramEmbedProps> = ({
  status,
  html,
  durableImageUrl,
  durableImageAlt,
  eventName,
  labels,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const contentNoLongerAvailableLabel = labels?.contentNoLongerAvailableLabel || 'This content is no longer available';
  const embedLoadingLabel = labels?.embedLoadingLabel || 'Loading embedded post…';
  const embedRegionLabel = labels?.embedRegionLabel || 'Embedded post';

  const showEmbed = status === 'AVAILABLE' && !!html;

  useEffect(() => {
    if (!showEmbed) {
      return;
    }

    setIsReady(false);

    let didProcess = false;
    const processEmbed = () => {
      if (didProcess) return;
      didProcess = true;
      window.instgrm?.Embeds?.process();
    };

    loadInstagramEmbedScript(processEmbed);

    const container = containerRef.current;
    let observer: MutationObserver | undefined;
    if (container && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        if (container.querySelector('iframe')) {
          setIsReady(true);
        }
      });
      observer.observe(container, { childList: true, subtree: true });
    }

    const fallbackTimer = setTimeout(() => {
      setIsReady(true);
    }, EMBED_READY_FALLBACK_TIMEOUT_MS);

    return () => {
      observer?.disconnect();
      clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEmbed, html]);

  if (showEmbed) {
    return (
      <div
        className="w-full relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden max-h-[70vh] min-h-[200px]"
        role="region"
        aria-label={embedRegionLabel}
        aria-busy={!isReady}
        aria-live="polite"
      >
        {!isReady && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 min-h-[200px] w-full animate-pulse"
            aria-label={embedLoadingLabel}
            data-testid="instagram-embed-loading"
          >
            <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
          </div>
        )}
        <div
          ref={containerRef}
          data-testid="instagram-embed-content"
          dangerouslySetInnerHTML={{ __html: html as string }}
        />
      </div>
    );
  }

  if (status === 'UNAVAILABLE' && durableImageUrl) {
    return (
      <EventImage
        imageUrl={durableImageUrl}
        imageAlt={durableImageAlt}
        eventName={eventName}
      />
    );
  }

  // unavailable-no-fallback: reuse EventImage's existing placeholder visual language
  // (AC7's escape-hatch) rather than inventing new iconography.
  return (
    <div
      className="w-full relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden max-h-[70vh] min-h-[200px]"
      role="region"
      aria-label={embedRegionLabel}
      aria-live="polite"
      data-testid="instagram-embed-unavailable"
    >
      <div className="flex flex-col items-center justify-center text-gray-400 min-h-[200px] w-full gap-2">
        <ImageIcon className="w-12 h-12 opacity-50" />
        <span className="text-sm">{contentNoLongerAvailableLabel}</span>
      </div>
    </div>
  );
};
