/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { virtual } from '@guidepup/virtual-screen-reader';
import { Heart } from 'lucide-react';
import { IconButton, ToggleIconButton } from './icon-button';
import { describeViolations, wcagViolations } from '../../a11y/axe-helper';

afterEach(cleanup);

describe('IconButton', () => {
  it('is a named, typed button whose icon is hidden from assistive technology', async () => {
    const { container } = render(<IconButton label="More actions" icon={<Heart />} />);
    const button = screen.getByRole('button', { name: 'More actions' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    const violations = await wcagViolations(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('keeps the 44 px touch target the project standard asks for', () => {
    render(<IconButton label="More actions" icon={<Heart />} />);
    const classes = screen.getByRole('button').className;
    expect(classes).toContain('min-h-11');
    expect(classes).toContain('min-w-11');
  });

  it('is operable with Enter and Space', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton label="More actions" icon={<Heart />} onClick={onClick} />);
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('refuses a missing label at compile time', () => {
    // @ts-expect-error `label` is required: an icon-only button without a name is the defect this component prevents.
    const element = <IconButton icon={<Heart />} />;
    expect(element).toBeTruthy();
  });
});

describe('ToggleIconButton', () => {
  it('speaks a fixed name with its pressed state, and flips on activation', async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    const { container, rerender } = render(<ToggleIconButton label="Favorite" icon={<Heart />} pressed={false} onPressedChange={onPressedChange} />);
    await virtual.start({ container });
    await virtual.next();
    expect(await virtual.lastSpokenPhrase()).toContain('button, Favorite, not pressed');
    await virtual.stop();

    await user.click(screen.getByRole('button', { name: 'Favorite' }));
    expect(onPressedChange).toHaveBeenCalledWith(true);

    rerender(<ToggleIconButton label="Favorite" icon={<Heart />} pressed onPressedChange={onPressedChange} />);
    expect(screen.getByRole('button', { name: 'Favorite' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Favorite' }));
    expect(onPressedChange).toHaveBeenLastCalledWith(false);
  });
});
