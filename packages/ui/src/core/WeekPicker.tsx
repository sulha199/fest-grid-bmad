import * as React from 'react';
import { Calendar } from './ui/calendar';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { getWeekStart, getWeekEnd } from '../hooks';

export interface WeekPickerProps {
  selectedDate?: string;
  onSelectWeek: (date: string) => void;
  getWeekRange?: (date: Date) => { start: Date; end: Date };
  buttonLabel?: string;
  ariaLabel?: string;
  className?: string;
}

function toDateOnly(date: Date) {
  const utc = new Date(date);
  utc.setHours(0, 0, 0, 0);
  return utc;
}

export function WeekPicker({
  selectedDate,
  onSelectWeek,
  getWeekRange,
  buttonLabel = 'Select week',
  ariaLabel = 'Select week',
  className,
}: WeekPickerProps) {
  // Default getWeekRange if not provided
  const fallbackGetWeekRange = (date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    const startIso = getWeekStart(iso);
    const endIso = getWeekEnd(startIso);
    const start = new Date(`${startIso}T12:00:00Z`);
    const end = new Date(`${endIso}T12:00:00Z`);
    return { start, end };
  };
  const effectiveGetWeekRange = getWeekRange ?? fallbackGetWeekRange;
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<string | undefined>(selectedDate);

  React.useEffect(() => {
    setCurrent(selectedDate);
  }, [selectedDate]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const isoString = iso.toISOString().slice(0, 10);
    setCurrent(isoString);
    onSelectWeek(isoString);
    setOpen(false);
  };

  const highlighted = React.useMemo(() => {
    if (!current) return undefined;
    const base = new Date(`${current}T12:00:00Z`);
    const range = effectiveGetWeekRange(base);
    return {
      start: toDateOnly(range.start),
      end: toDateOnly(range.end),
    };
  }, [current, effectiveGetWeekRange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={className}
          aria-label={ariaLabel}
        >
          {buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={current ? new Date(`${current}T12:00:00Z`) : undefined}
          defaultMonth={current ? new Date(`${current}T12:00:00Z`) : undefined}
          onSelect={(date) => handleSelect(date)}
          modifiers={{
            highlighted: (date) => {
              if (!highlighted) return false;
              const normalized = toDateOnly(date);
              return normalized >= highlighted.start && normalized <= highlighted.end;
            },
          }}
          modifiersClassNames={{
            highlighted: 'bg-accent text-accent-foreground rounded-none',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
