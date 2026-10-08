import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AccountLocationField } from './AccountLocationField';

describe('AccountLocationField Component', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    location: {
      formattedAddress: 'Jakarta, Indonesia',
      placeName: 'Jakarta'
    },
    isPendingReview: false,
    onEdit: vi.fn(),
    labels: {
      editLabel: 'Edit Default Location',
      pendingReviewLabel: 'Pending Review'
    }
  };

  it('renders nothing when location is null or undefined', () => {
    const { container } = render(<AccountLocationField {...defaultProps} location={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders formattedAddress when available', () => {
    render(<AccountLocationField {...defaultProps} />);
    expect(screen.getByText('Jakarta, Indonesia')).toBeInTheDocument();
  });

  it('renders placeName as fallback when formattedAddress is missing', () => {
    render(<AccountLocationField {...defaultProps} location={{ formattedAddress: null, placeName: 'Surabaya' }} />);
    expect(screen.getByText('Surabaya')).toBeInTheDocument();
  });

  it('renders pending review badge conditionally', () => {
    const { rerender } = render(<AccountLocationField {...defaultProps} isPendingReview={false} />);
    expect(screen.queryByText('Pending Review')).not.toBeInTheDocument();

    rerender(<AccountLocationField {...defaultProps} isPendingReview={true} />);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    render(<AccountLocationField {...defaultProps} />);
    const editBtn = screen.getByRole('button', { name: 'Edit Default Location' });
    fireEvent.click(editBtn);
    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders no second icon when onClear is omitted (existing consumers unaffected)', () => {
    render(<AccountLocationField {...defaultProps} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByLabelText('Clear location')).not.toBeInTheDocument();
  });

  it('renders the clear button and calls onClear on click when onClear is provided', () => {
    const onClear = vi.fn();
    render(
      <AccountLocationField
        {...defaultProps}
        onClear={onClear}
        labels={{ ...defaultProps.labels, clearLabel: 'Clear location' }}
      />
    );
    const clearBtn = screen.getByRole('button', { name: 'Clear location' });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
