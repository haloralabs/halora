import { describe, expect, test } from 'bun:test';
import { render, screen } from '@/test/render';
import { HaloMark, Logo } from './logo';

describe('Logo', () => {
  test('the mark is decorative unless titled', () => {
    const { container } = render(<HaloMark />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    render(<HaloMark title="Halora" />);
    expect(screen.getByRole('img', { name: 'Halora' })).toBeDefined();
  });
  test('renders the wordmark', () => {
    render(<Logo />);
    expect(screen.getByText('Halora')).toBeDefined();
  });
});
