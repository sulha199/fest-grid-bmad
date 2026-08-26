import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { TabbedShellProps } from './TabbedShell.types';
import { cn } from '../../lib/utils';

export function TabbedShell({ tabs, activeKey, onTabChange, className }: TabbedShellProps) {
  const lastCalledRef = React.useRef<string | null>(activeKey);

  React.useEffect(() => {
    lastCalledRef.current = activeKey;
  }, [activeKey]);

  const handleTabChange = React.useCallback((key: string) => {
    if (key !== lastCalledRef.current) {
      lastCalledRef.current = key;
      onTabChange(key);
    }
  }, [onTabChange]);

  return (
    <Tabs value={activeKey} onValueChange={handleTabChange} className={cn('w-full space-y-6', className)}>
      <TabsList className="inline-flex h-11 items-center justify-start rounded-lg bg-gray-100 p-1 text-muted-foreground dark:bg-slate-800">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              "data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
              "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => {
        const Component = tab.Component;
        return (
          <TabsContent
            key={tab.key}
            value={tab.key}
            forceMount={tab.keepMounted || undefined}
            className={cn('outline-none mt-4', tab.keepMounted && 'data-[state=inactive]:hidden')}
          >
            <Component />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export default TabbedShell;
