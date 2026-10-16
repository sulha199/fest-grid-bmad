import '@testing-library/jest-dom/vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ExtractionStatusFilter } from './ExtractionStatusFilter'
import type { PostExtractionStatus } from './ExtractionStatusFilter'

const labels = {
  PENDING: 'Pending',
  QUEUED: 'Queued',
  EXTRACTING: 'Extracting',
  PROMOTED: 'Promoted to event',
  NOT_EVENT: 'Not an event',
} as Record<PostExtractionStatus, string>

afterEach(cleanup)

describe('ExtractionStatusFilter', () => {
  it('renders one toggle per status in display order, marking the selected ones as pressed', () => {
    render(<ExtractionStatusFilter value={['PENDING']} onChange={() => {}} groupLabel="Filter by status" labels={labels} />)
    const group = screen.getByRole('group', { name: 'Filter by status' })
    const buttons = Array.from(group.querySelectorAll('button')).map((b) => b.textContent)
    expect(buttons).toEqual(['Pending', 'Queued', 'Extracting', 'Promoted to event', 'Not an event'])
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Queued' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('adds a status to the selection, keeping display order', () => {
    const onChange = vi.fn()
    render(<ExtractionStatusFilter value={['PENDING', 'PROMOTED']} onChange={onChange} groupLabel="g" labels={labels} />)
    fireEvent.click(screen.getByRole('button', { name: 'Queued' }))
    expect(onChange).toHaveBeenCalledWith(['PENDING', 'QUEUED', 'PROMOTED'])
  })

  it('removes a status from a multi-status selection', () => {
    const onChange = vi.fn()
    render(<ExtractionStatusFilter value={['PENDING', 'QUEUED']} onChange={onChange} groupLabel="g" labels={labels} />)
    fireEvent.click(screen.getByRole('button', { name: 'Queued' }))
    expect(onChange).toHaveBeenCalledWith(['PENDING'])
  })

  it('ignores an attempt to deselect the last remaining status', () => {
    const onChange = vi.fn()
    render(<ExtractionStatusFilter value={['PENDING']} onChange={onChange} groupLabel="g" labels={labels} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
