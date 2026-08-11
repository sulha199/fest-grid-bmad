import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { EventType, EventCategory } from "@festgrid/shared-types";
import { ProposedEventCorrection } from "@festgrid/domain/events";
import { CorrectionForm } from "./CorrectionForm";
import { CorrectionFormLabels } from "./CorrectionForm.types";

describe("CorrectionForm", () => {
  afterEach(() => {
    cleanup();
  });

  const mockLabels: CorrectionFormLabels = {
    eventNameLabel: "Event Name",
    typesLabel: "Types",
    categoriesLabel: "Categories",
    locationLabel: "Location",
    organizerNameLabel: "Organizer Name",
    contactInfoLabel: "Contact Info",
    descriptionLabel: "Description",
    scheduleStartDateLabel: "Start Date",
    scheduleEndDateLabel: "End Date",
    scheduleStartTimeLabel: "Start Time",
    scheduleEndTimeLabel: "End Time",
    scheduleTitleLabel: "Schedule Title",
    schedulePerformersLabel: "Performers",
    scheduleLocationLabel: "Schedule Location",
    scheduleTicketPriceLabel: "Ticket Price",
    submitButtonLabel: "Submit",
    cancelButtonLabel: "Cancel",
    unmatchedErrorFallbackLabel: "Unmatched Errors Found",
  };

  const typeOptions = [
    { value: EventType.FESTIVAL, label: "Festival" },
    { value: EventType.PERFORMANCE, label: "Gig" },
  ];

  const categoryOptions = [
    { value: EventCategory.MUSIC, label: "Music" },
    { value: EventCategory.ARTS_AND_CULTURE, label: "Comedy" },
  ];

  const initialValues: ProposedEventCorrection = {
    eventName: "Initial Event",
    types: [EventType.FESTIVAL],
    categories: [EventCategory.MUSIC],
    location: "Event Location",
    organizerName: "Organizer",
    contactInfo: "Contact",
    description: "Description text",
    schedules: [
      {
        id: "sched-1",
        isMainSchedule: true,
        eventStartDate: "2026-08-11",
        eventEndDate: "2026-08-12",
        eventStartTime: "18:00",
        eventEndTime: "22:00",
        title: "Main Stage",
        performers: ["Performer A", "Performer B"],
        location: "Main Location",
        ticketPrice: "$20",
      },
    ],
  };

  it("pre-fills all event-level fields and the main-schedule fields correctly", () => {
    render(
      <CorrectionForm
        initialValues={initialValues}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        labels={mockLabels}
      />
    );

    expect(screen.getByLabelText("Event Name")).toHaveValue("Initial Event");
    expect(screen.getByLabelText("Location")).toHaveValue("Event Location");
    expect(screen.getByLabelText("Organizer Name")).toHaveValue("Organizer");
    expect(screen.getByLabelText("Contact Info")).toHaveValue("Contact");
    expect(screen.getByLabelText("Description")).toHaveValue("Description text");

    expect(screen.getByLabelText("Start Date")).toHaveValue("2026-08-11");
    expect(screen.getByLabelText("End Date")).toHaveValue("2026-08-12");
    expect(screen.getByLabelText("Start Time")).toHaveValue("18:00");
    expect(screen.getByLabelText("End Time")).toHaveValue("22:00");
    expect(screen.getByLabelText("Schedule Title")).toHaveValue("Main Stage");
    expect(screen.getByLabelText("Performers")).toHaveValue("Performer A, Performer B");
    expect(screen.getByLabelText("Schedule Location")).toHaveValue("Main Location");
    expect(screen.getByLabelText("Ticket Price")).toHaveValue("$20");
  });

  it("uses the first schedule as fallback when no schedule has isMainSchedule: true", () => {
    const valuesNoMain: ProposedEventCorrection = {
      ...initialValues,
      schedules: [
        {
          id: "sched-2",
          isMainSchedule: false,
          eventStartDate: "2026-08-15",
          title: "Alternative Stage",
        },
      ],
    };

    render(
      <CorrectionForm
        initialValues={valuesNoMain}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        labels={mockLabels}
      />
    );

    expect(screen.getByLabelText("Start Date")).toHaveValue("2026-08-15");
    expect(screen.getByLabelText("Schedule Title")).toHaveValue("Alternative Stage");
  });

  it("disables all inputs, both MultiSelects, and buttons when isSubmitting is true", () => {
    render(
      <CorrectionForm
        initialValues={initialValues}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={true}
        labels={mockLabels}
      />
    );

    expect(screen.getByLabelText("Event Name")).toBeDisabled();
    expect(screen.getByLabelText("Location")).toBeDisabled();
    expect(screen.getByLabelText("Organizer Name")).toBeDisabled();
    expect(screen.getByLabelText("Contact Info")).toBeDisabled();
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.getByLabelText("Start Date")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    // Fieldset should be disabled
    const fieldset = screen.getByRole("group", { name: "Types" }).closest("fieldset");
    expect(fieldset).toBeDisabled();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <CorrectionForm
        initialValues={initialValues}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        labels={mockLabels}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onSubmit with exactly one schedules entry carrying its original id even if multiple initial schedules were present", () => {
    const onSubmit = vi.fn();
    const valuesMultipleSchedules: ProposedEventCorrection = {
      ...initialValues,
      schedules: [
        {
          id: "sched-ignored",
          isMainSchedule: false,
          eventStartDate: "2026-08-10",
        },
        {
          id: "sched-keep",
          isMainSchedule: true,
          eventStartDate: "2026-08-11",
          performers: ["Artist A"],
        },
      ],
    };

    render(
      <CorrectionForm
        initialValues={valuesMultipleSchedules}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        labels={mockLabels}
      />
    );

    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submittedData = onSubmit.mock.calls[0][0] as ProposedEventCorrection;
    expect(submittedData.schedules).toHaveLength(1);
    expect(submittedData.schedules[0].id).toBe("sched-keep");
    expect(submittedData.schedules[0].isMainSchedule).toBe(true);
    expect(submittedData.schedules[0].eventStartDate).toBe("2026-08-11");
  });

  it("renders validation errors inline for matched fields, and in the fallback banner for unmatched fields", () => {
    const validationErrors = [
      { field: "eventName", message: "Event Name is required" },
      { field: "schedules[0].eventStartDate", message: "Start Date must be in the future" },
      { field: "schedules[0].id", message: "You do not own this schedule" },
    ];

    render(
      <CorrectionForm
        initialValues={initialValues}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        validationErrors={validationErrors}
        labels={mockLabels}
      />
    );

    // Matched fields inline errors
    expect(screen.getByText("Event Name is required")).toBeInTheDocument();
    expect(screen.getByText("Start Date must be in the future")).toBeInTheDocument();

    // Fallback banner
    expect(screen.getByText("Unmatched Errors Found")).toBeInTheDocument();
    expect(screen.getByText("You do not own this schedule")).toBeInTheDocument();
  });

  it("handles empty performers or formatted comma performers round-trips correctly", () => {
    const onSubmit = vi.fn();
    render(
      <CorrectionForm
        initialValues={initialValues}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        labels={mockLabels}
      />
    );

    const performersInput = screen.getByLabelText("Performers");
    fireEvent.change(performersInput, { target: { value: "Artist X ,  Artist Y, , Artist Z" } });

    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submittedData = onSubmit.mock.calls[0][0] as ProposedEventCorrection;
    expect(submittedData.schedules[0].performers).toEqual(["Artist X", "Artist Y", "Artist Z"]);
  });

  it("renders headerActions slot when provided, and renders nothing extra when omitted", () => {
    const { rerender } = render(
      <CorrectionForm
        initialValues={initialValues}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        labels={mockLabels}
      />
    );

    expect(screen.queryByText("AI Helper Button")).not.toBeInTheDocument();

    rerender(
      <CorrectionForm
        initialValues={initialValues}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        headerActions={<button type="button">AI Helper Button</button>}
        labels={mockLabels}
      />
    );

    expect(screen.getByText("AI Helper Button")).toBeInTheDocument();
  });

  it("allows selecting/deselecting options in MultiSelect to update submitted types and categories", () => {
    const onSubmit = vi.fn();
    render(
      <CorrectionForm
        initialValues={initialValues}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        labels={mockLabels}
      />
    );

    // Initially Festival (selected) and Gig (not selected)
    const gigButton = screen.getByRole("button", { name: "Gig" });
    fireEvent.click(gigButton);

    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submittedData = onSubmit.mock.calls[0][0] as ProposedEventCorrection;
    expect(submittedData.types).toEqual([EventType.FESTIVAL, EventType.PERFORMANCE]);
  });
});
