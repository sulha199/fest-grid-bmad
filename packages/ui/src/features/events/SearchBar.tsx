"use client"

import { type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
  onSubmit: (query: string) => void;
  onEnter?: (query: string) => void;
  placeholder: string;
  clearLabel: string;
  className?: string;
}

import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '../../hooks/useDebounce';

export function SearchBar({
  query,
  onChange,
  onSubmit,
  onEnter,
  placeholder,
  clearLabel,
  className = '',
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(query);
  const debouncedValue = useDebounce(inputValue, 400);
  const mounted = useRef(false);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    if (mounted.current) {
      const trimmed = debouncedValue.trim();
      onSubmit(trimmed);
    } else {
      mounted.current = true;
    }
  }, [debouncedValue, onSubmit]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      onSubmit(trimmed);
      if (onEnter) {
        onEnter(trimmed);
      }
    }
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    onSubmit('');
  };

  const handleChange = (val: string) => {
    setInputValue(val);
    onChange(val);
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {inputValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={clearLabel}
          className="absolute right-3 inline-flex h-full items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm px-1"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
