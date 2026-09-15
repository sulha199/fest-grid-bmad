import * as React from 'react';
import { MultiSelect } from '../../core/multi-select';
import { PlatformIcon } from '../../core/platform-icon';

export interface SubscriptionAccountProfile {
  id: string;
  platform: string;
  displayName: string;
  username: string;
  profileImageUrl?: string | null;
}

export interface SubscriptionItem {
  id: string;
  account: SubscriptionAccountProfile;
}

export interface SubscriptionPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  subscriptions: SubscriptionItem[];
  facetLabel: string;
  labels?: {
    clearLabel?: string;
  };
}

export function SubscriptionPicker({
  value,
  onChange,
  subscriptions,
  facetLabel,
  labels,
}: SubscriptionPickerProps) {
  const options = React.useMemo(() => {
    return subscriptions.map((sub) => {
      const { id, account } = sub;
      const displayName = account.displayName || `@${account.username}`;

      const optionLabel = (
        <span className="flex items-center gap-1.5">
          <PlatformIcon platform={account.platform} className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
          <span>{displayName}</span>
        </span>
      );

      return {
        value: id,
        label: optionLabel,
      };
    });
  }, [subscriptions]);

  return (
    <MultiSelect
      facetLabel={facetLabel}
      options={options}
      selectedValues={value}
      onChange={onChange}
      labels={labels}
    />
  );
}
