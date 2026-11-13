/**
 * Props for the UpgradeCta primitive (Story 10.3a, show the subscription cap refusal and the upgrade call to action).
 * Every string is a plain prop the app resolves (this package never imports next-intl) and the primitive knows nothing
 * about what is being upgraded or why.
 */
export interface UpgradeCtaProps {
  /** The button text, for example "Upgrade". */
  label: string;
  /** The badge text beside the label, for example "Coming soon". Plain text, so colour is never the only signal. */
  comingSoonLabel: string;
  /** The note shown under the button, which is also the button's accessible description. */
  note: string;
  /** Replaces `note` after the first click. */
  afterClickNote: string;
  /** Called once when the primitive first mounts (a ref guard keeps StrictMode's double effect to one call). */
  onShown?: () => void;
  /** Called on every click. */
  onClick?: () => void;
  className?: string;
}
