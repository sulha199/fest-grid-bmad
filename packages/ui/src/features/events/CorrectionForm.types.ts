import type { ProposedEventCorrection } from '@festgrid/domain/events';

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export interface CorrectionFormLabels {
  eventNameLabel: string;
  typesLabel: string;
  categoriesLabel: string;
  locationLabel: string;
  organizerNameLabel: string;
  contactInfoLabel: string;
  descriptionLabel: string;
  scheduleStartDateLabel: string;
  scheduleEndDateLabel: string;
  scheduleStartTimeLabel: string;
  scheduleEndTimeLabel: string;
  scheduleTitleLabel: string;
  schedulePerformersLabel: string;
  scheduleLocationLabel: string;
  scheduleTicketPriceLabel: string;
  submitButtonLabel: string;
  cancelButtonLabel: string;
  unmatchedErrorFallbackLabel: string;
  guardianPermissionCheckboxLabel: string;
  // Story 4.10 (AC9) — the repeatable Links field. The per-row labels are function-typed
  // because row count is dynamic ("Link 1 URL" vs "Link 2 URL" can't be expressed ahead of
  // time as a flat string, unlike every other field in this shape).
  linksLabel: string;
  addLinkButtonLabel: string;
  maxLinksReachedLabel: string;
  linkUrlLabel: (index: number) => string;
  linkLabelLabel: (index: number) => string;
  removeLinkLabel: (index: number) => string;
}

export interface CorrectionFormProps {
  initialValues: ProposedEventCorrection;
  typeOptions: { value: string; label: string }[];
  categoryOptions: { value: string; label: string }[];
  validationErrors?: ValidationErrorItem[];
  onSubmit: (data: ProposedEventCorrection, guardianPermissionConfirmed: boolean) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  headerActions?: React.ReactNode;
  labels: CorrectionFormLabels;
  guardianPermissionConfirmed?: boolean;
  onGuardianPermissionConfirmedChange?: (checked: boolean) => void;
}
