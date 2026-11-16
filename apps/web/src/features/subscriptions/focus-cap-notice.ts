/** Moves focus to the title of the inline cap notice inside `container` (used when the user presses Enter while the refusal stands). */
export function focusCapNotice(container: HTMLElement | null): void {
  container?.querySelector<HTMLElement>('[data-cap-notice-title]')?.focus();
}
