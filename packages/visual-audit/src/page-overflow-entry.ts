/**
 * Lightweight entry for consumers that only need page-level overflow detection (e.g. `apps/web`'s
 * e2e matrix): avoids loading the full engine and its `ts-morph`/`sharp` dependencies.
 */

export { detectPageOverflow, installEvaluateHelpers, settleLayout } from './compare/page-overflow.js';
export {
  isOverflowing,
  describeOverflow,
  classifyPageHealth,
  type PageOverflowResult,
  type PageOverflowOffender,
} from './rules/page-overflow.js';

export { measurePopup } from './compare/popup-containment.js';
export { checkPopupContainment, type PopupMeasurement } from './rules/popup-containment.js';
