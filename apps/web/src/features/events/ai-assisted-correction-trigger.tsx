"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  useExtractEventDataFromUrlMutation,
  useExtractionJobQuery,
  ExtractionErrorCode,
  ExtractionJobState,
} from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { Button } from "@/components/ui/button";

export interface AiAssistedCorrectionTriggerLabels {
  triggerButtonLabel: React.ReactNode;
  urlInputLabel: React.ReactNode;
  urlInputPlaceholder: string;
  extractButtonLabel: React.ReactNode;
  extractingAnnouncement: React.ReactNode;
  stillProcessing: React.ReactNode;
  errorNotFound: React.ReactNode;
  errorUnsupportedPlatform: React.ReactNode;
  errorNoApiKey: React.ReactNode;
  errorScrapeFailed: React.ReactNode;
  errorExtractionFailed: React.ReactNode;
  errorQuotaExhausted: React.ReactNode;
}

const POLL_INTERVAL_MS = 2000;
const STILL_PROCESSING_AFTER_MS = 15000;

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
  // Story 4.2b -- the mutation only starts a job; the extraction itself runs in the AI Lambda and
  // is polled (Server State: React Query). A non-null jobId means "a job is in flight".
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStillProcessing, setIsStillProcessing] = useState(false);
  const handledJobRef = useRef<string | null>(null);

  const { mutateAsync: startExtraction, isPending: isStarting } = useExtractEventDataFromUrlMutation(graphqlClient);

  const jobQuery = useExtractionJobQuery(
    graphqlClient,
    { id: jobId ?? "" },
    {
      enabled: jobId !== null,
      retry: 2,
      refetchInterval: (query) => {
        const status = query.state.data?.extractionJob.status;
        return status === ExtractionJobState.Succeeded || status === ExtractionJobState.Failed
          ? false
          : POLL_INTERVAL_MS;
      },
    }
  );

  const isBusy = isStarting || jobId !== null;

  // Reacts to the polled job reaching a terminal state (or the poll itself erroring out).
  useEffect(() => {
    if (jobId === null || handledJobRef.current === jobId) return;
    const job = jobQuery.data?.extractionJob;
    if (job?.status === ExtractionJobState.Succeeded) {
      handledJobRef.current = jobId;
      setJobId(null);
      if (job.data) {
        onExtracted(job.data);
      } else {
        setErrorType(ExtractionErrorCode.ExtractionFailed);
      }
    } else if (job?.status === ExtractionJobState.Failed) {
      handledJobRef.current = jobId;
      setJobId(null);
      setErrorType(job.errorCode ?? ExtractionErrorCode.ExtractionFailed);
    } else if (jobQuery.isError) {
      handledJobRef.current = jobId;
      setJobId(null);
      setErrorType(ExtractionErrorCode.ExtractionFailed);
    }
  }, [jobId, jobQuery.data, jobQuery.isError, onExtracted]);

  // "Still processing" affordance after a while; cleared as soon as no job is in flight.
  useEffect(() => {
    if (jobId === null) {
      setIsStillProcessing(false);
      return;
    }
    const timer = setTimeout(() => setIsStillProcessing(true), STILL_PROCESSING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [jobId]);

  const handleExtract = async () => {
    if (!url.trim() || isBusy) return;

    setErrorType(null);

    try {
      const response = await startExtraction({ url: url.trim() });
      const result = response.extractEventDataFromUrl;

      if (result.errorCode) {
        setErrorType(result.errorCode);
      } else if (result.jobId) {
        setJobId(result.jobId);
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
                disabled={isBusy}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                type="button"
                onClick={handleExtract}
                disabled={isBusy || !url.trim()}
                className="shrink-0"
                size="sm"
              >
                {isBusy ? (
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
                    {isStillProcessing ? labels.stillProcessing : labels.extractingAnnouncement}
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
