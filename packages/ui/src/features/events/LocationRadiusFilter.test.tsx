import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationRadiusFilter } from "./LocationRadiusFilter";

const defaultLabels = {
  filterLabel: "Nearby",
  offOptionLabel: "All locations",
  currentLocationOptionLabel: "Current location",
  radiusLabel: "Radius",
  radiusUnit: (count: number) => `${count} km`,
  detectingLocationLabel: "Detecting your location...",
  permissionDeniedLabel: "Location access denied — showing all events.",
  unavailableLabel: "Couldn't detect your location — showing all events.",
  locationsErrorLabel: "Couldn't load your saved locations.",
  noSavedLocationsHint: "Save a location in My Locations to filter by a specific place.",
};

describe("LocationRadiusFilter", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when unauthenticated", () => {
    const { container } = render(
      <LocationRadiusFilter
        isAuthenticated={false}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue={null}
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders All locations and saved location names when locations exist", () => {
    const savedLocations = [
      { id: "loc-1", name: "Home", radiusKm: 10 },
      { id: "loc-2", name: "Work", radiusKm: 25 },
    ];

    render(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={savedLocations}
        selectedValue="off"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByLabelText("Nearby")).toBeDefined();
    expect(screen.getByRole("option", { name: "All locations" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Home" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Work" })).toBeDefined();
    expect(screen.queryByRole("option", { name: "Current location" })).toBeNull();
  });

  it("renders Current location option and noSavedLocationsHint only when zero saved locations", () => {
    render(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="off"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByRole("option", { name: "Current location" })).toBeDefined();
    expect(screen.getByText(defaultLabels.noSavedLocationsHint)).toBeDefined();
  });

  it("shows loading and error states for saved locations", () => {
    render(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={true}
        locationsError={true}
        savedLocations={[]}
        selectedValue="off"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByText("Loading...")).toBeDefined();
    expect(screen.getByRole("alert")).toHaveTextContent(defaultLabels.locationsErrorLabel);
  });

  it("hides radius slider when selectedValue is off, shows when it is a location or current", () => {
    const { rerender } = render(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[{ id: "loc-1", name: "Home", radiusKm: 10 }]}
        selectedValue="off"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.queryByLabelText("Radius")).toBeNull();

    rerender(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[{ id: "loc-1", name: "Home", radiusKm: 10 }]}
        selectedValue="loc-1"
        radiusKm={10}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByLabelText("Radius")).toBeDefined();
    expect(screen.getByText("10 km")).toBeDefined();
  });

  it("calls onSelectLocation and onRadiusChange correctly", async () => {
    const user = userEvent.setup();
    const onSelectLocation = vi.fn();
    const onRadiusChange = vi.fn();

    render(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[{ id: "loc-1", name: "Home", radiusKm: 10 }]}
        selectedValue="loc-1"
        radiusKm={10}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={onSelectLocation}
        onRadiusChange={onRadiusChange}
        labels={defaultLabels}
      />
    );

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "off" } });
    expect(onSelectLocation).toHaveBeenCalledWith("off");

    const slider = screen.getByLabelText("Radius");
    fireEvent.change(slider, { target: { value: "25" } });
    expect(onRadiusChange).toHaveBeenCalledWith(25);
  });

  it("shows detecting and error states for current location capture", () => {
    const { rerender } = render(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="current"
        radiusKm={5}
        isCapturingCurrentLocation={true}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByText(defaultLabels.detectingLocationLabel)).toBeDefined();

    rerender(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="current"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError="permission-denied"
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByText(defaultLabels.permissionDeniedLabel)).toBeDefined();

    rerender(
      <LocationRadiusFilter
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="current"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError="unavailable"
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByText(defaultLabels.unavailableLabel)).toBeDefined();
  });
});
