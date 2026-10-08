"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { EventType, EventCategory, EventLink } from "@festgrid/shared-types";
import { ProposedEventCorrection, ProposedScheduleCorrection } from "@festgrid/domain/events";
import { MultiSelect } from "../../core/multi-select";
import { Checkbox } from "../../core/checkbox";
import { CorrectionFormProps } from "./CorrectionForm.types";

const MAX_LINKS = 10;
const LINK_FIELD_PATTERN = /^links\[\d+\]\.(url|label)$/;

export function CorrectionForm({
  initialValues,
  typeOptions,
  categoryOptions,
  validationErrors,
  onSubmit,
  onCancel,
  isSubmitting = false,
  headerActions,
  labels,
  guardianPermissionConfirmed: guardianPermissionConfirmedProp,
  onGuardianPermissionConfirmedChange,
}: CorrectionFormProps) {
  // Resolve the editable schedule
  const mainSchedule = initialValues.schedules?.find((s) => s.isMainSchedule) ?? initialValues.schedules?.[0] ?? {
    isMainSchedule: true,
    eventStartDate: "",
  };

  // Seed local states once on mount
  const [eventName, setEventName] = useState(initialValues.eventName || "");
  const [types, setTypes] = useState<EventType[]>(initialValues.types || []);
  const [categories, setCategories] = useState<EventCategory[]>(initialValues.categories || []);
  const [location, setLocation] = useState(initialValues.location || "");
  const [organizerName, setOrganizerName] = useState(initialValues.organizerName || "");
  const [contactInfo, setContactInfo] = useState(initialValues.contactInfo || "");
  const [description, setDescription] = useState(initialValues.description || "");

  // Schedule states
  const [scheduleStartDate, setScheduleStartDate] = useState(mainSchedule.eventStartDate || "");
  const [scheduleEndDate, setScheduleEndDate] = useState(mainSchedule.eventEndDate || "");
  const [scheduleStartTime, setScheduleStartTime] = useState(mainSchedule.eventStartTime || "");
  const [scheduleEndTime, setScheduleEndTime] = useState(mainSchedule.eventEndTime || "");
  const [scheduleTitle, setScheduleTitle] = useState(mainSchedule.title || "");
  const [schedulePerformers, setSchedulePerformers] = useState(
    mainSchedule.performers ? mainSchedule.performers.join(", ") : ""
  );
  const [scheduleLocation, setScheduleLocation] = useState(mainSchedule.location || "");
  const [scheduleTicketPrice, setScheduleTicketPrice] = useState(mainSchedule.ticketPrice || "");

  // Story 4.10 (AC9) — the repeatable "Links" field. Local useState, same as every other
  // field in this component (see Dev Notes "State Management Categorization").
  const [links, setLinks] = useState<EventLink[]>(initialValues.links || []);
  const linkUrlInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const addLinkButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingLinkFocusRef = useRef<{ type: "url"; index: number } | { type: "add" } | null>(null);
  const atLinksCap = links.length >= MAX_LINKS;

  useEffect(() => {
    const pending = pendingLinkFocusRef.current;
    if (!pending) return;
    pendingLinkFocusRef.current = null;
    if (pending.type === "add") {
      addLinkButtonRef.current?.focus();
    } else {
      linkUrlInputRefs.current[pending.index]?.focus();
    }
  }, [links]);

  const handleAddLink = () => {
    if (atLinksCap) return;
    setLinks((prev) => {
      const next = [...prev, { url: "", label: "" }];
      pendingLinkFocusRef.current = { type: "url", index: next.length - 1 };
      return next;
    });
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        pendingLinkFocusRef.current = { type: "add" };
      } else if (index < next.length) {
        // The row that shifted up now occupies this same index.
        pendingLinkFocusRef.current = { type: "url", index };
      } else {
        // The removed row was last -- focus the previous row.
        pendingLinkFocusRef.current = { type: "url", index: next.length - 1 };
      }
      return next;
    });
  };

  const handleLinkUrlChange = (index: number, value: string) => {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, url: value } : l)));
  };

  const handleLinkLabelChange = (index: number, value: string) => {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, label: value } : l)));
  };

  // Guardian-permission declaration checkbox (Story 3.6k, AC5). Nothing else in this
  // form is externally controlled either, so fall back to internal local state when
  // the caller doesn't pass the controlled prop pair.
  const [guardianPermissionConfirmedState, setGuardianPermissionConfirmedState] = useState(false);
  const guardianPermissionConfirmed = guardianPermissionConfirmedProp ?? guardianPermissionConfirmedState;
  const handleGuardianPermissionConfirmedChange = (checked: boolean) => {
    if (onGuardianPermissionConfirmedChange) {
      onGuardianPermissionConfirmedChange(checked);
    } else {
      setGuardianPermissionConfirmedState(checked);
    }
  };

  // List of fields that are considered "matched" to render error inline
  const matchedFields = [
    "eventName",
    "types",
    "categories",
    "location",
    "organizerName",
    "contactInfo",
    "description",
    "eventStartDate",
    "schedules[0].eventStartDate",
    "eventEndDate",
    "schedules[0].eventEndDate",
    "eventStartTime",
    "schedules[0].eventStartTime",
    "eventEndTime",
    "schedules[0].eventEndTime",
    "title",
    "schedules[0].title",
    "performers",
    "schedules[0].performers",
    "schedules[0].location",
    "ticketPrice",
    "schedules[0].ticketPrice",
  ];

  const isMatchedField = (field: string): boolean => {
    // Story 4.10 (AC9) — links[0].url / links[0].label can't be enumerated ahead of time
    // like every other field above, since row count is dynamic.
    return matchedFields.includes(field) || LINK_FIELD_PATTERN.test(field);
  };

  const getFieldError = (fieldNames: string[]) => {
    const found = validationErrors?.find((err) => fieldNames.includes(err.field));
    return found ? found.message : undefined;
  };

  const unmatchedErrors = validationErrors?.filter((err) => !isMatchedField(err.field)) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Split performers on comma, trim, filter out empty strings
    const performersArray = schedulePerformers
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "");

    // Assemble edited schedule
    const editedSchedule: ProposedScheduleCorrection = {
      isMainSchedule: true,
      eventStartDate: scheduleStartDate,
    };

    if (mainSchedule.id) {
      editedSchedule.id = mainSchedule.id;
    }
    if (scheduleEndDate) {
      editedSchedule.eventEndDate = scheduleEndDate;
    }
    if (scheduleStartTime) {
      editedSchedule.eventStartTime = scheduleStartTime;
    }
    if (scheduleEndTime) {
      editedSchedule.eventEndTime = scheduleEndTime;
    }
    if (scheduleTitle) {
      editedSchedule.title = scheduleTitle;
    }
    if (performersArray.length > 0) {
      editedSchedule.performers = performersArray;
    }
    if (scheduleLocation) {
      editedSchedule.location = scheduleLocation;
    }
    if (scheduleTicketPrice) {
      editedSchedule.ticketPrice = scheduleTicketPrice;
    }

    const payload: ProposedEventCorrection = {
      eventName,
      types,
      categories,
      location,
      schedules: [editedSchedule],
    };

    if (organizerName) {
      payload.organizerName = organizerName;
    }
    if (contactInfo) {
      payload.contactInfo = contactInfo;
    }
    if (description) {
      payload.description = description;
    }

    // Story 4.10 (AC9) — differs from the omit-when-empty convention above: a non-empty
    // links list is sent in full; an explicit clear (seeded with links, now empty) must still
    // send `links: []` so the backend's three-state rule (AC5) can distinguish "the user
    // cleared every link" from "this submission never touched links at all".
    if (links.length > 0) {
      payload.links = links;
    } else if ((initialValues.links?.length ?? 0) > 0) {
      payload.links = [];
    }

    onSubmit(payload, guardianPermissionConfirmed);
  };

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const textareaClass =
    "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 h-auto";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-slate-900 dark:text-slate-100">
      {headerActions && <div className="header-actions-container">{headerActions}</div>}

      {unmatchedErrors.length > 0 && (
        <div className="p-4 rounded-md border border-destructive/20 bg-destructive/5 text-destructive text-sm" role="alert">
          <span className="font-semibold block mb-2">{labels.unmatchedErrorFallbackLabel}</span>
          <ul className="list-disc pl-5 space-y-1">
            {unmatchedErrors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset disabled={isSubmitting} className="flex flex-col gap-6">
        {/* Event Info Section */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="eventName" className="text-sm font-medium">
              {labels.eventNameLabel}
            </label>
            <input
              id="eventName"
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className={inputClass}
            />
            {getFieldError(["eventName"]) && (
              <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                {getFieldError(["eventName"])}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <MultiSelect
                facetLabel={labels.typesLabel}
                options={typeOptions}
                selectedValues={types}
                onChange={(values) => setTypes(values as EventType[])}
                hideClearAction
              />
              {getFieldError(["types"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["types"])}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <MultiSelect
                facetLabel={labels.categoriesLabel}
                options={categoryOptions}
                selectedValues={categories}
                onChange={(values) => setCategories(values as EventCategory[])}
                hideClearAction
              />
              {getFieldError(["categories"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["categories"])}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="location" className="text-sm font-medium">
              {labels.locationLabel}
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
            />
            {getFieldError(["location"]) && (
              <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                {getFieldError(["location"])}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="organizerName" className="text-sm font-medium">
                {labels.organizerNameLabel}
              </label>
              <input
                id="organizerName"
                type="text"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                className={inputClass}
              />
              {getFieldError(["organizerName"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["organizerName"])}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contactInfo" className="text-sm font-medium">
                {labels.contactInfoLabel}
              </label>
              <input
                id="contactInfo"
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className={inputClass}
              />
              {getFieldError(["contactInfo"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["contactInfo"])}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium">
              {labels.descriptionLabel}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={textareaClass}
            />
            {getFieldError(["description"]) && (
              <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                {getFieldError(["description"])}
              </span>
            )}
          </div>

          {/* Links section (Story 4.10, AC9) */}
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">{labels.linksLabel}</legend>

            {links.map((link, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row gap-2 md:items-start rounded-md border border-input p-3"
              >
                <div className="flex flex-col gap-1.5 flex-1">
                  <label htmlFor={`links-url-${index}`} className="text-sm font-medium">
                    {labels.linkUrlLabel(index + 1)}
                  </label>
                  <input
                    id={`links-url-${index}`}
                    type="text"
                    value={link.url}
                    ref={(el) => {
                      linkUrlInputRefs.current[index] = el;
                    }}
                    onChange={(e) => handleLinkUrlChange(index, e.target.value)}
                    className={inputClass}
                  />
                  {getFieldError([`links[${index}].url`]) && (
                    <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                      {getFieldError([`links[${index}].url`])}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 w-full md:w-56">
                  <label htmlFor={`links-label-${index}`} className="text-sm font-medium">
                    {labels.linkLabelLabel(index + 1)}
                  </label>
                  <input
                    id={`links-label-${index}`}
                    type="text"
                    value={link.label ?? ""}
                    onChange={(e) => handleLinkLabelChange(index, e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="button"
                  aria-label={labels.removeLinkLabel(index + 1)}
                  onClick={() => handleRemoveLink(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors self-end md:self-start md:mt-6 h-10 w-10 flex items-center justify-center"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="flex flex-col gap-1.5 items-start">
              <button
                type="button"
                ref={addLinkButtonRef}
                onClick={handleAddLink}
                aria-disabled={atLinksCap}
                disabled={atLinksCap}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {labels.addLinkButtonLabel}
              </button>
              {atLinksCap && (
                <span className="text-xs text-muted-foreground">{labels.maxLinksReachedLabel}</span>
              )}
            </div>
          </fieldset>
        </div>

        {/* Divider */}
        <hr className="border-slate-200 dark:border-slate-800" />

        {/* Schedule Info Section */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="scheduleStartDate" className="text-sm font-medium">
                {labels.scheduleStartDateLabel}
              </label>
              <input
                id="scheduleStartDate"
                type="date"
                value={scheduleStartDate}
                onChange={(e) => setScheduleStartDate(e.target.value)}
                className={inputClass}
              />
              {getFieldError(["schedules[0].eventStartDate", "eventStartDate"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["schedules[0].eventStartDate", "eventStartDate"])}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="scheduleEndDate" className="text-sm font-medium">
                {labels.scheduleEndDateLabel}
              </label>
              <input
                id="scheduleEndDate"
                type="date"
                value={scheduleEndDate}
                onChange={(e) => setScheduleEndDate(e.target.value)}
                className={inputClass}
              />
              {getFieldError(["schedules[0].eventEndDate", "eventEndDate"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["schedules[0].eventEndDate", "eventEndDate"])}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="scheduleStartTime" className="text-sm font-medium">
                {labels.scheduleStartTimeLabel}
              </label>
              <input
                id="scheduleStartTime"
                type="time"
                value={scheduleStartTime}
                onChange={(e) => setScheduleStartTime(e.target.value)}
                className={inputClass}
              />
              {getFieldError(["schedules[0].eventStartTime", "eventStartTime"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["schedules[0].eventStartTime", "eventStartTime"])}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="scheduleEndTime" className="text-sm font-medium">
                {labels.scheduleEndTimeLabel}
              </label>
              <input
                id="scheduleEndTime"
                type="time"
                value={scheduleEndTime}
                onChange={(e) => setScheduleEndTime(e.target.value)}
                className={inputClass}
              />
              {getFieldError(["schedules[0].eventEndTime", "eventEndTime"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["schedules[0].eventEndTime", "eventEndTime"])}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="scheduleTitle" className="text-sm font-medium">
              {labels.scheduleTitleLabel}
            </label>
            <input
              id="scheduleTitle"
              type="text"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              className={inputClass}
            />
            {getFieldError(["schedules[0].title", "title"]) && (
              <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                {getFieldError(["schedules[0].title", "title"])}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="schedulePerformers" className="text-sm font-medium">
              {labels.schedulePerformersLabel}
            </label>
            <input
              id="schedulePerformers"
              type="text"
              value={schedulePerformers}
              onChange={(e) => setSchedulePerformers(e.target.value)}
              className={inputClass}
            />
            {getFieldError(["schedules[0].performers", "performers"]) && (
              <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                {getFieldError(["schedules[0].performers", "performers"])}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="scheduleLocation" className="text-sm font-medium">
                {labels.scheduleLocationLabel}
              </label>
              <input
                id="scheduleLocation"
                type="text"
                value={scheduleLocation}
                onChange={(e) => setScheduleLocation(e.target.value)}
                className={inputClass}
              />
              {getFieldError(["schedules[0].location"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["schedules[0].location"])}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="scheduleTicketPrice" className="text-sm font-medium">
                {labels.scheduleTicketPriceLabel}
              </label>
              <input
                id="scheduleTicketPrice"
                type="text"
                value={scheduleTicketPrice}
                onChange={(e) => setScheduleTicketPrice(e.target.value)}
                className={inputClass}
              />
              {getFieldError(["schedules[0].ticketPrice", "ticketPrice"]) && (
                <span className="text-xs text-destructive mt-1 block font-medium" role="alert">
                  {getFieldError(["schedules[0].ticketPrice", "ticketPrice"])}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Guardian-permission declaration (Story 3.6k, AC5) */}
        <div className="flex flex-col gap-1.5">
          <Checkbox
            id="guardianPermissionConfirmed"
            label={labels.guardianPermissionCheckboxLabel}
            checked={guardianPermissionConfirmed}
            onChange={handleGuardianPermissionConfirmedChange}
          />
        </div>

        {/* Form Actions Section */}
        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {labels.cancelButtonLabel}
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {labels.submitButtonLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
