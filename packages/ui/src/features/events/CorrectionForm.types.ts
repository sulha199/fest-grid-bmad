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
}

export interface CorrectionFormProps {
  initialValues: ProposedEventCorrection;
  typeOptions: { value: string; label: string }[];
  categoryOptions: { value: string; label: string }[];
  validationErrors?: ValidationErrorItem[];
  onSubmit: (data: ProposedEventCorrection) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  headerActions?: React.ReactNode;
  labels: CorrectionFormLabels;
}
