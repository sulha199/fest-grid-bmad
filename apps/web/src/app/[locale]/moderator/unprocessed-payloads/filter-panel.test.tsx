import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FilterPanel } from "./filter-panel"

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      filterSourceLabel: "Source",
      filterVendorLabel: "Vendor",
      filterDateStartLabel: "From (Date)",
      filterDateEndLabel: "To (Date)",
      filterSortLabel: "Sort by",
      filterSortNewest: "Newest first",
      filterSortOldest: "Oldest first",
      filterApplyButton: "Apply filters",
      filterClearButton: "Clear all",
    }
    return translations[key] || key
  },
}))

describe("FilterPanel", () => {
  const mockOnFilterChange = vi.fn()
  const defaultFilters = {
    source: null,
    vendor: null,
    createdAfter: null,
    createdBefore: null,
    sortOrder: "newest" as const,
  }

  beforeEach(() => {
    mockOnFilterChange.mockClear()
  })

  it("renders filter controls", () => {
    render(<FilterPanel filters={defaultFilters} onFilterChange={mockOnFilterChange} />)
    expect(screen.getByText("Source")).toBeInTheDocument()
    expect(screen.getByText("Vendor")).toBeInTheDocument()
    expect(screen.getByText("Apply filters")).toBeInTheDocument()
    expect(screen.getByText("Clear all")).toBeInTheDocument()
  })

  it("updates source filter on selection", async () => {
    const user = userEvent.setup()
    render(<FilterPanel filters={defaultFilters} onFilterChange={mockOnFilterChange} />)

    const sourceSelect = screen.getByDisplayValue("All Sources")
    await user.selectOption(sourceSelect, "APIFY")

    expect(mockOnFilterChange).toHaveBeenCalledWith({ source: "APIFY" })
  })

  it("updates vendor filter on input", async () => {
    const user = userEvent.setup()
    render(<FilterPanel filters={defaultFilters} onFilterChange={mockOnFilterChange} />)

    const vendorInput = screen.getByPlaceholderText("e.g., Instagram")
    await user.type(vendorInput, "Instagram")

    expect(mockOnFilterChange).toHaveBeenCalledWith({ vendor: "I" }) // Called for each keystroke
  })

  it("clears all filters on Clear button click", async () => {
    const user = userEvent.setup()
    render(<FilterPanel filters={defaultFilters} onFilterChange={mockOnFilterChange} />)

    const clearButton = screen.getByText("Clear all")
    await user.click(clearButton)

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      source: null,
      vendor: null,
      createdAfter: null,
      createdBefore: null,
      sortOrder: "newest",
    })
  })

  it("updates sort order on selection", async () => {
    const user = userEvent.setup()
    render(<FilterPanel filters={defaultFilters} onFilterChange={mockOnFilterChange} />)

    const sortSelect = screen.getByDisplayValue("Newest first")
    await user.selectOption(sortSelect, "oldest")

    expect(mockOnFilterChange).toHaveBeenCalledWith({ sortOrder: "oldest" })
  })
})
