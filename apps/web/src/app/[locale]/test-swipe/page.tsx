"use client";
import { SwipeToReveal } from '@festgrid/ui';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function TestPage() {
  const [items, setItems] = useState(['Item 1', 'Item 2', 'Item 3']);

  const handleDelete = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    console.log(`Deleted item at index ${index}`);
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Swipe to Reveal Test</h1>
      
      <div className="flex flex-col gap-4" dir="ltr">
        <h2 className="text-lg font-semibold">LTR Mode</h2>
        {items.map((item, i) => (
          <SwipeToReveal
            key={item}
            action={
              <div className="bg-red-500 text-white w-20 h-full flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
            }
            onAction={() => handleDelete(i)}
            className="border rounded-lg"
          >
            <div className="p-4 bg-white dark:bg-zinc-900 flex justify-between items-center shadow-sm">
              <span>{item}</span>
              <span className="text-xs text-gray-500">{'<'}-- Swipe</span>
            </div>
          </SwipeToReveal>
        ))}
      </div>

      <div className="flex flex-col gap-4 mt-12" dir="rtl">
        <h2 className="text-lg font-semibold">RTL Mode</h2>
        {items.map((item, i) => (
          <SwipeToReveal
            key={`rtl-${item}`}
            action={
              <div className="bg-red-500 text-white w-20 h-full flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
            }
            onAction={() => handleDelete(i)}
            className="border rounded-lg"
          >
            <div className="p-4 bg-white dark:bg-zinc-900 flex justify-between items-center shadow-sm">
              <span>{item} (RTL)</span>
              <span className="text-xs text-gray-500">Swipe --{'>'}</span>
            </div>
          </SwipeToReveal>
        ))}
      </div>
    </div>
  );
}
