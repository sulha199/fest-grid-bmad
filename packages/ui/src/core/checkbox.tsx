import * as React from 'react';
import { CheckboxProps } from './checkbox.types';

export function Checkbox({
  id,
  label,
  checked,
  onChange,
  className = '',
  disabled = false,
}: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-slate-700 dark:text-slate-300 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer disabled:cursor-not-allowed"
      />
      <span>{label}</span>
    </label>
  );
}
