import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LocationLink } from './LocationLink';

// Story 0.i7z (superseded by location keywords slice 2b) -- AD-14 Rule 2: `LocationLink` is
// the event-detail and account-card map link. It no longer gates on `isLocationTrustworthy`:
// it is always a Google Maps text search (searchQuery, else name), never coordinates, with a
// single trailing ExternalLink icon, so a low-confidence match looks like a confirmed one.
describe('LocationLink', () => {
  afterEach(() => {
    cleanup();
  });

  it('always renders the pin icon and name text inside a single always-clickable, new-tab <a>', () => {
    render(<LocationLink name="Central Park" />);

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Central Park')).toBeInTheDocument();
  });

  it('links a text search on the keywords query, with no coordinates', () => {
    render(<LocationLink name="Pasar Porosjayan" searchQuery="Pasar Porosjayan Gamping Sleman" />);

    const link = screen.getByRole('link', { name: 'Pasar Porosjayan' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Pasar%20Porosjayan%20Gamping%20Sleman'
    );
  });

  it('falls back to the name when searchQuery is absent, null or blank', () => {
    const expected = 'https://www.google.com/maps/search/?api=1&query=Central%20Park';
    for (const searchQuery of [undefined, null, '   ']) {
      const { unmount } = render(<LocationLink name="Central Park" searchQuery={searchQuery} />);
      expect(screen.getByRole('link', { name: 'Central Park' })).toHaveAttribute('href', expected);
      unmount();
    }
  });

  it('renders the same single ExternalLink icon (plus pin) whatever the query', () => {
    render(<LocationLink name="Central Park" searchQuery="Central Park New York" />);

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link.querySelectorAll('svg')).toHaveLength(2);
    expect(link.querySelector('svg.lucide-external-link')).toBeInTheDocument();
    expect(link.querySelector('svg.lucide-search')).not.toBeInTheDocument();
  });

  it('correctly encodeURIComponent-escapes a name containing spaces and special characters in the fallback href', () => {
    render(<LocationLink name="Rock & Roll Bar, 5th Ave" />);

    const link = screen.getByRole('link', { name: 'Rock & Roll Bar, 5th Ave' });
    expect(link).toHaveAttribute(
      'href',
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Rock & Roll Bar, 5th Ave')}`
    );
  });

  it('applies ariaLabel as aria-label on the wrapping <a> when provided', () => {
    render(<LocationLink name="Central Park" ariaLabel="Open location in Google Maps" />);

    const link = screen.getByRole('link', { name: 'Open location in Google Maps' });
    expect(link).toHaveAttribute('aria-label', 'Open location in Google Maps');
  });

  it('omits aria-label from the DOM when ariaLabel is not provided', () => {
    render(<LocationLink name="Central Park" />);

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).not.toHaveAttribute('aria-label');
  });

  it('returns null (renders nothing) for an empty name', () => {
    const { container } = render(<LocationLink name="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null (renders nothing) for a whitespace-only name', () => {
    const { container } = render(<LocationLink name="   " />);
    expect(container).toBeEmptyDOMElement();
  });
});
