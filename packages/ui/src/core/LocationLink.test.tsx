import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LocationLink } from './LocationLink';

// Story 0.i7z ratchet — AD-14 Rule 2 / Story 0.i7z AC 3 consumer: this component is the
// event-detail and account-card map-link gate. Proves `LocationLink` calls
// `isLocationTrustworthy` and branches its `href`/trailing icon on the result (coordinate
// link + ExternalLink icon when trustworthy, text-query fallback + Search icon otherwise).
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

  it('links the raw coordinate and renders ExternalLink icon for a trustworthy (confidence>=0.5, full_match) location', () => {
    render(
      <LocationLink
        name="Central Park"
        coordinates={{ lat: 40.785091, lng: -73.968285 }}
        confidence={0.9}
        matchType="full_match"
      />
    );

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=40.785091,-73.968285'
    );
    // ExternalLink icon rendered, not Search
    expect(link.querySelectorAll('svg')).toHaveLength(2);
  });

  it('treats the exact boundary confidence 0.5 as trustworthy (>=, not >)', () => {
    render(
      <LocationLink
        name="Central Park"
        coordinates={{ lat: 40.785091, lng: -73.968285 }}
        confidence={0.5}
        matchType="full_match"
      />
    );

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=40.785091,-73.968285'
    );
  });

  it('falls back to a text-query search for confidence just below the boundary (0.49)', () => {
    render(
      <LocationLink
        name="Central Park"
        coordinates={{ lat: 40.785091, lng: -73.968285 }}
        confidence={0.49}
        matchType="full_match"
      />
    );

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Central%20Park'
    );
  });

  it('falls back to a text-query search when matchType is not full_match', () => {
    render(
      <LocationLink
        name="Central Park"
        coordinates={{ lat: 40.785091, lng: -73.968285 }}
        confidence={0.9}
        matchType="partial_match"
      />
    );

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Central%20Park'
    );
  });

  it('falls back to a text-query search when coordinates are entirely absent', () => {
    render(<LocationLink name="Central Park" confidence={0.9} matchType="full_match" />);

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Central%20Park'
    );
  });

  it('falls back to a text-query search when confidence and matchType are explicitly null', () => {
    render(
      <LocationLink
        name="Central Park"
        coordinates={{ lat: 40.785091, lng: -73.968285 }}
        confidence={null}
        matchType={null}
      />
    );

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Central%20Park'
    );
  });

  it('falls back to a text-query search when confidence and matchType are undefined', () => {
    render(
      <LocationLink name="Central Park" coordinates={{ lat: 40.785091, lng: -73.968285 }} />
    );

    const link = screen.getByRole('link', { name: 'Central Park' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Central%20Park'
    );
  });

  it('never renders the ExternalLink icon in the untrustworthy fallback case', () => {
    render(<LocationLink name="Central Park" />);

    const link = screen.getByRole('link', { name: 'Central Park' });
    // Pin icon + Search icon only (2 total)
    expect(link.querySelectorAll('svg')).toHaveLength(2);
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
