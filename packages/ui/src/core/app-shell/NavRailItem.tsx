'use client';

import React from 'react';
import { useNavRailItemInteraction } from '../../hooks/useNavRailItemInteraction';
import { NavRailItemProps } from './NavRailItem.types';

export function NavRailItem(props: NavRailItemProps) {
  const { variant, icon, label, className = '' } = props;

  // Set default currentPath/href for hook signature compatibility
  const href = props.variant === 'link' ? props.href : undefined;
  const currentPath = props.variant === 'link' ? props.currentPath : undefined;
  const onActivate = props.variant === 'trigger' ? props.onActivate : undefined;

  const { isActive, tooltipVisible, isFlashing, handlers } = useNavRailItemInteraction({
    variant,
    href,
    currentPath,
    onActivate,
  });

  // Token classes from DESIGN.md
  const hitAreaClass = 'min-h-11 min-w-11 flex items-center gap-3 justify-center xl:justify-start';
  const labelClass = 'hidden xl:inline text-sm font-medium';
  const tooltipClass = 'md:group-hover:opacity-100 md:group-focus-visible:opacity-100 xl:hidden';
  const activeIndicatorClass = 'bg-nav-active-indicator w-1 rounded-full absolute top-0 md:inset-y-0 md:start-0 h-1 md:h-auto md:w-1';
  const activeIconClass = 'text-nav-active-indicator [&_svg]:fill-current';
  const focusRingClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';

  // Base layout: group and relative are needed for tooltip and active-indicator positioning
  const baseClasses = `group relative ${hitAreaClass} ${focusRingClass} ${className}`;

  const renderedIcon = (
    <span className={`relative flex items-center justify-center h-5 w-5 ${isActive ? activeIconClass : ''}`}>
      {icon}
    </span>
  );

  const renderedLabel = (
    <span className={labelClass}>
      {label}
    </span>
  );

  const renderedActiveIndicator = isActive && (
    <span className={activeIndicatorClass} />
  );

  const renderedTooltip = (tooltipVisible || isFlashing) && (
    <span
      className={`absolute start-16 z-50 rounded bg-popover text-popover-foreground px-2 py-1 text-xs border shadow-md pointer-events-none transition-opacity ${tooltipClass}`}
      role="tooltip"
    >
      {label}
    </span>
  );

  if (variant === 'link') {
    const { renderLink } = props;
    const LinkComponent = renderLink;

    return (
      <LinkComponent
        href={props.href}
        className={baseClasses}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        {...handlers}
      >
        {renderedActiveIndicator}
        {renderedIcon}
        {renderedLabel}
        {renderedTooltip}
      </LinkComponent>
    );
  }

  // Trigger variant (button root)
  const { ariaExpanded = false } = props;

  return (
    <button
      type="button"
      className={baseClasses}
      aria-label={label}
      aria-haspopup="true"
      aria-expanded={ariaExpanded}
      {...handlers}
    >
      {renderedIcon}
      {renderedLabel}
      {renderedTooltip}
    </button>
  );
}
