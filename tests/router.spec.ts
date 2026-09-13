import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../src/lib/router';

describe('parseHash', () => {
  it('parses the empty string and bare "#" as the feed route', () => {
    expect(parseHash('')).toEqual({ name: 'feed' });
    expect(parseHash('#')).toEqual({ name: 'feed' });
  });

  it('parses "#/" as the feed route', () => {
    expect(parseHash('#/')).toEqual({ name: 'feed' });
  });

  it('parses "#/library" as the library route', () => {
    expect(parseHash('#/library')).toEqual({ name: 'library' });
  });

  it('parses "#/settings" as the settings route', () => {
    expect(parseHash('#/settings')).toEqual({ name: 'settings' });
  });

  it('parses "#/work/:id" as a work route with the decoded id', () => {
    expect(parseHash('#/work/dickinson-because-i-could-not-stop-for-death-1863')).toEqual({
      name: 'work',
      id: 'dickinson-because-i-could-not-stop-for-death-1863',
    });
  });

  it('decodes a percent-encoded work id', () => {
    expect(parseHash('#/work/a%2Fb')).toEqual({ name: 'work', id: 'a/b' });
  });

  it('ignores a trailing slash on known routes', () => {
    expect(parseHash('#/library/')).toEqual({ name: 'library' });
    expect(parseHash('#/work/some-id/')).toEqual({ name: 'work', id: 'some-id' });
  });

  it('accepts a hash without the leading "#"', () => {
    expect(parseHash('/library')).toEqual({ name: 'library' });
  });

  it('falls back to not-found for an unknown path', () => {
    expect(parseHash('#/nope')).toEqual({ name: 'not-found', hash: '/nope' });
  });

  it('falls back to not-found for a work route with no id', () => {
    expect(parseHash('#/work/')).toEqual({ name: 'not-found', hash: '/work' });
  });
});

describe('routeToHash', () => {
  it('formats each named route', () => {
    expect(routeToHash({ name: 'feed' })).toBe('#/');
    expect(routeToHash({ name: 'library' })).toBe('#/library');
    expect(routeToHash({ name: 'settings' })).toBe('#/settings');
    expect(routeToHash({ name: 'styleguide' })).toBe('#/styleguide');
  });

  it('formats a work route, percent-encoding the id', () => {
    expect(routeToHash({ name: 'work', id: 'a/b' })).toBe('#/work/a%2Fb');
  });

  it('round-trips through parseHash for feed, library, settings, and work routes', () => {
    for (const route of [
      { name: 'feed' as const },
      { name: 'library' as const },
      { name: 'settings' as const },
      { name: 'work' as const, id: 'blake-the-tyger-1794' },
    ]) {
      expect(parseHash(routeToHash(route))).toEqual(route);
    }
  });
});
