"use client";

import React, { useState } from "react";
import { useExtractEventDataFromUrlMutation, ExtractionErrorCode } from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { Button } from "@/components/ui/button";

export interface AiAssistedCorrectionTriggerLabels {
  triggerButtonLabel: React.ReactNode;
  urlInputLabel: React.ReactNode;
  urlInputPlaceholder: string;
  extractButtonLabel: React.ReactNode;
  extractingAnnouncement: React.ReactNode;
  errorNotFound: React.ReactNode;
  errorUnsupportedPlatform: React.ReactNode;
  errorNoApiKey: React.ReactNode;
  errorScrapeFailed: React.ReactNode;
  errorExtractionFailed: React.ReactNode;
  errorQuotaExhausted: React.ReactNode;
}

interface AiAssistedCorrectionTriggerProps {
  labels: AiAssistedCorrectionTriggerLabels;
  onExtracted: (data: any) => void;
}

export function AiAssistedCorrectionTrigger({
  labels,
  onExtracted,
}: AiAssistedCorrectionTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [errorType, setErrorType] = useState<ExtractionErrorCode | null>(null);

  const { mutateAsync: extractData, isPending } = useExtractEventDataFromUrlMutation(graphqlClient);

  const handleExtract = async () => {
    if (!url.trim() || isPending) return;

    setErrorType(null);

    try {
      const response = await extractData({ url: url.trim() });
      const result = response.extractEventDataFromUrl;

      if (result.errorCode) {
        setErrorType(result.errorCode);
      } else if (result.data) {
        onExtracted(result.data);
      } else {
        setErrorType(ExtractionErrorCode.ExtractionFailed);
      }
    } catch (err) {
      setErrorType(ExtractionErrorCode.ExtractionFailed);
    }
  };

  const renderError = () => {
    if (!errorType) return null;

    let errorContent: React.ReactNode = null;
    switch (errorType) {
      case "NOT_FOUND":
        errorContent = labels.errorNotFound;
        break;
      case "UNSUPPORTED_PLATFORM":
        errorContent = labels.errorUnsupportedPlatform;
        break;
      case "NO_API_KEY":
        errorContent = labels.errorNoApiKey;
        break;
      case "SCRAPE_FAILED":
        errorContent = labels.errorScrapeFailed;
        break;
      case "EXTRACTION_FAILED":
        errorContent = labels.errorExtractionFailed;
        break;
      case "QUOTA_EXHAUSTED":
        errorContent = labels.errorQuotaExhausted;
        break;
      default:
        errorContent = labels.errorExtractionFailed;
    }

    return (
      <div className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
        {errorContent}
      </div>
    );
  };

  return (
    <div className="w-full border rounded-lg p-4 bg-muted/30 dark:bg-muted/10 space-y-4">
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto"
        >
          {labels.triggerButtonLabel}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col space-y-1.5">
            <label htmlFor="ai-url-input" className="text-sm font-medium">
              {labels.urlInputLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="ai-url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={labels.urlInputPlaceholder}
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                type="button"
                onClick={handleExtract}
                disabled={isPending || !url.trim()}
                className="shrink-0"
                size="sm"
              >
                {isPending ? (
                  <span className="flex items-center gap-1.5" aria-live="assertive">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.143 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {labels.extractingAnnouncement}
                  </span>
                ) : (
                  labels.extractButtonLabel
                )}
              </Button>
            </div>
          </div>
          {renderError()}
        </div>
      )}
    </div>
  );
}
