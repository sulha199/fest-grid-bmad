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
    guardianPermissionCheckboxLabel: "I confirm I have parent/guardian permission if this includes a minor",
    linksLabel: "Links",
    addLinkButtonLabel: "Add link",
    maxLinksReachedLabel: "Maximum of 10 links reached",
    linkUrlLabel: (n: number) => `Link ${n} URL`,
    linkLabelLabel: (n: number) => `Link ${n} label (optional)`,
    removeLinkLabel: (n: number) => `Remove link ${n}`,
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

  describe("guardian-permission declaration checkbox (Story 3.6k, AC5)", () => {
    it("renders the checkbox, unchecked by default", () => {
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

      const checkbox = screen.getByLabelText(
        "I confirm I have parent/guardian permission if this includes a minor"
      );
      expect(checkbox).not.toBeChecked();
    });

    it("toggles when clicked (uncontrolled/local state)", () => {
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

      const checkbox = screen.getByLabelText(
        "I confirm I have parent/guardian permission if this includes a minor"
      );
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it("calls onSubmit with (data, guardianPermissionConfirmed) reflecting the checkbox state", () => {
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

      const checkbox = screen.getByLabelText(
        "I confirm I have parent/guardian permission if this includes a minor"
      );
      fireEvent.click(checkbox);

      fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][1]).toBe(true);
    });

    it("calls onSubmit with guardianPermissionConfirmed: false when the checkbox is left unchecked", () => {
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

      fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][1]).toBe(false);
    });

    it("respects the controlled prop pair when provided", () => {
      const onChange = vi.fn();
      render(
        <CorrectionForm
          initialValues={initialValues}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          labels={mockLabels}
          guardianPermissionConfirmed={true}
          onGuardianPermissionConfirmedChange={onChange}
        />
      );

      const checkbox = screen.getByLabelText(
        "I confirm I have parent/guardian permission if this includes a minor"
      );
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe("repeatable Links field (Story 4.10, AC9)", () => {
    it("pre-fills existing initialValues.links as rows", () => {
      render(
        <CorrectionForm
          initialValues={{ ...initialValues, links: [{ url: "https://tickets.example.com", label: "Tickets" }] }}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          labels={mockLabels}
        />
      );

      expect(screen.getByLabelText("Link 1 URL")).toHaveValue("https://tickets.example.com");
      expect(screen.getByLabelText("Link 1 label (optional)")).toHaveValue("Tickets");
    });

    it('"Add link" appends a row and moves focus to its url input', () => {
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

      expect(screen.queryByLabelText("Link 1 URL")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Add link" }));

      const url1 = screen.getByLabelText("Link 1 URL");
      expect(url1).toBeInTheDocument();
      expect(url1).toHaveFocus();
    });

    it("removing a non-last row moves focus to the url input of the row that shifted up into that index", () => {
      render(
        <CorrectionForm
          initialValues={{
            ...initialValues,
            links: [
              { url: "https://one.example.com" },
              { url: "https://two.example.com" },
              { url: "https://three.example.com" },
            ],
          }}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          labels={mockLabels}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Remove link 1" }));

      const url1 = screen.getByLabelText("Link 1 URL");
      expect(url1).toHaveValue("https://two.example.com");
      expect(url1).toHaveFocus();
    });

    it("removing the last remaining row moves focus to the Add button", () => {
      render(
        <CorrectionForm
          initialValues={{ ...initialValues, links: [{ url: "https://only.example.com" }] }}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          labels={mockLabels}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Remove link 1" }));

      expect(screen.queryByLabelText("Link 1 URL")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add link" })).toHaveFocus();
    });

    it("removing the last row (of several) when it was last moves focus to the previous row's url input", () => {
      render(
        <CorrectionForm
          initialValues={{
            ...initialValues,
            links: [{ url: "https://one.example.com" }, { url: "https://two.example.com" }],
          }}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          labels={mockLabels}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Remove link 2" }));

      const url1 = screen.getByLabelText("Link 1 URL");
      expect(url1).toHaveValue("https://one.example.com");
      expect(url1).toHaveFocus();
    });

    it('"Add link" becomes disabled at 10 rows', () => {
      const tenLinks = Array.from({ length: 10 }, (_, i) => ({ url: `https://example.com/${i}` }));
      render(
        <CorrectionForm
          initialValues={{ ...initialValues, links: tenLinks }}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          labels={mockLabels}
        />
      );

      const addButton = screen.getByRole("button", { name: "Add link" });
      expect(addButton).toBeDisabled();
      expect(addButton).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByText("Maximum of 10 links reached")).toBeInTheDocument();
    });

    it("renders a links[0].url validation error inline next to that row's url field", () => {
      render(
        <CorrectionForm
          initialValues={{ ...initialValues, links: [{ url: "javascript:alert(1)" }] }}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          validationErrors={[{ field: "links[0].url", message: "Link URL must be a valid http(s) web address" }]}
          labels={mockLabels}
        />
      );

      expect(screen.getByText("Link URL must be a valid http(s) web address")).toBeInTheDocument();
      // Must render inline (matched), not in the unmatched-errors fallback banner.
      expect(screen.queryByText("Unmatched Errors Found")).not.toBeInTheDocument();
    });

    it("omits links when the form was seeded with none and the user added none", () => {
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

      fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submittedData = onSubmit.mock.calls[0][0] as ProposedEventCorrection;
      expect(submittedData.links).toBeUndefined();
    });

    it("submits links: [] when the form was seeded with links and the user removed them all", () => {
      const onSubmit = vi.fn();
      render(
        <CorrectionForm
          initialValues={{ ...initialValues, links: [{ url: "https://only.example.com" }] }}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
          labels={mockLabels}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Remove link 1" }));
      fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submittedData = onSubmit.mock.calls[0][0] as ProposedEventCorrection;
      expect(submittedData.links).toEqual([]);
    });

    it("submits the full edited links array when rows were added/edited", () => {
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

      fireEvent.click(screen.getByRole("button", { name: "Add link" }));
      fireEvent.change(screen.getByLabelText("Link 1 URL"), { target: { value: "https://tickets.example.com" } });
      fireEvent.change(screen.getByLabelText("Link 1 label (optional)"), { target: { value: "Tickets" } });

      fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submittedData = onSubmit.mock.calls[0][0] as ProposedEventCorrection;
      expect(submittedData.links).toEqual([{ url: "https://tickets.example.com", label: "Tickets" }]);
    });
  });
});
