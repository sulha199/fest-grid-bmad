'use client';

interface RawJsonViewerProps {
  value: unknown;
}

function tryParseJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function RawJsonViewer({ value }: RawJsonViewerProps) {
  const displayText = tryParseJson(value);

  return (
    <div className="overflow-auto rounded border border-border bg-muted p-3 max-h-96">
      <pre
        role="region"
        aria-label="JSON content"
        className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap"
      >
        {displayText}
      </pre>
    </div>
  );
}
