import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeSource,
  gutenbergToText,
  injectExcerpt,
  parseArguments,
  sliceExcerpt,
  xhtmlToText,
} from '../scripts/inject-excerpt.mjs';

// -------- neutral placeholder fixtures (never real literary text) --------

const XHTML_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter One</title><style>body { color: red; }</style></head>
<body>
<section epub:type="chapter">
<h2>Chapter I</h2>
<p>It is a placeholder truth, needed only for a test fixture, that a sentence in want of words must be padded out a little further.</p>
<p>The quick brown fox jumped over something,<br/>
and then it jumped again,<br/>
because verse needs line breaks.</p>
<p>Second   paragraph   with   extra    spacing   and an &amp; entity, an &mdash; dash, and a &rsquo;quote&rsquo;.</p>
</section>
</body>
</html>`;

function gutenbergFixture() {
  return [
    'The Project Gutenberg eBook of A Placeholder Title',
    '',
    'This ebook is for the use of anyone anywhere in most jurisdictions.',
    '',
    '*** START OF THE PROJECT GUTENBERG EBOOK A PLACEHOLDER TITLE ***',
    '',
    'Chapter One',
    '',
    'This is the first wrapped line of a placeholder\nparagraph that spans two lines for testing.',
    '',
    'This is a second placeholder paragraph, on its\nown, also spanning two lines of wrapped text.',
    '',
    '*** END OF THE PROJECT GUTENBERG EBOOK A PLACEHOLDER TITLE ***',
    '',
    'This ebook was produced by volunteers and is in the public domain.',
    '',
  ].join('\n');
}

/** A neutral placeholder paragraph of exactly `wordCount` words. */
function placeholderParagraph(label: string, wordCount: number) {
  return Array.from({ length: wordCount }, (_, i) => `${label}-word-${i}`).join(' ');
}

/** A minimal, schema-valid short_story `Work` fixture, textPolicy 'excerpt'. */
function makeExcerptWork(overrides: Record<string, unknown> = {}) {
  const placeholderExcerpt = placeholderParagraph('seed', 520);
  return {
    id: 'fixture-inject-excerpt-work-2020',
    type: 'short_story',
    title: 'A Fixture Work',
    author: 'Fixture Author',
    year: 2020,
    era: 'contemporary',
    form: 'short story',
    themes: ['memory'],
    tags: ['fixture'],
    length: { unit: 'words', value: 520 },
    difficulty: 2,
    source: {
      name: 'Placeholder Source',
      url: '',
      license: 'public-domain',
      retrievedDate: '2026-09-01',
    },
    textPolicy: 'excerpt',
    excerpt: placeholderExcerpt,
    excerptNote: 'placeholder note, to be overwritten',
    externalLinks: [{ kind: 'other', url: 'https://example.com/read' }],
    masterNotes: {
      context: 'Placeholder context paragraph for testing purposes only.',
      form: 'Placeholder form discussion paragraph for testing purposes only.',
      keyImages: ['Placeholder key image one.', 'Placeholder key image two.'],
      whatToNotice: ['Placeholder thing to notice.'],
      discussionQuestions: [
        'Placeholder discussion question one?',
        'Placeholder discussion question two?',
        'Placeholder discussion question three?',
      ],
      furtherReading: ['Placeholder further reading reference.'],
    },
    pipeline: {
      batchId: 'test-batch',
      dateAdded: '2026-09-01',
      curatedBy: 'test',
      schemaVersion: 1,
    },
    ...overrides,
  };
}

/** A minimal, schema-valid short_story `Work` fixture, textPolicy 'full'. */
function makeFullWork(overrides: Record<string, unknown> = {}) {
  return {
    ...makeExcerptWork(overrides),
    id: 'fixture-inject-full-work-2020',
    textPolicy: 'full',
    text: 'TODO placeholder full text.',
    excerpt: undefined,
    excerptNote: undefined,
    externalLinks: undefined,
    ebookLinks: [{ provider: 'gutenberg', format: 'html', url: 'https://example.com/ebook' }],
    ...overrides,
  };
}

describe('inject-excerpt: pure converters', () => {
  it('xhtmlToText strips tags/head/style, decodes entities, collapses layout whitespace, and keeps <br/> as verse line breaks', () => {
    const result = xhtmlToText(XHTML_FIXTURE);

    expect(result).not.toMatch(/<[^>]+>/);
    expect(result).not.toContain('color: red');
    expect(result).not.toContain('Chapter One'); // was in <head><title>, stripped with head

    expect(result).toContain('Chapter I'); // <h2> inside body is kept
    expect(result).toContain('It is a placeholder truth');
    expect(result).toContain('Second paragraph with extra spacing and an & entity, an — dash, and a ’quote’.');

    const paragraphs = result.split('\n\n');
    const versePara = paragraphs.find((p) => p.includes('quick brown fox'));
    expect(versePara).toBeDefined();
    expect(versePara?.split('\n')).toHaveLength(3);
    expect(versePara?.split('\n')[1]).toBe('and then it jumped again,');
  });

  it('gutenbergToText strips the START/END markers and everything outside them, and rejoins wrapped lines', () => {
    const result = gutenbergToText(gutenbergFixture());

    expect(result).not.toContain('Project Gutenberg eBook of A Placeholder Title');
    expect(result).not.toContain('produced by volunteers');
    expect(result).not.toContain('START OF');
    expect(result).not.toContain('END OF');

    expect(result).toContain('Chapter One');
    expect(result).toContain(
      'This is the first wrapped line of a placeholder paragraph that spans two lines for testing.'
    );
    expect(result).not.toContain('placeholder\nparagraph'); // wrapped line was rejoined
  });

  it('describeSource derives a host/owner/repo string and a friendly name for known GitHub mirrors', () => {
    expect(
      describeSource(
        'https://raw.githubusercontent.com/standardebooks/jane-austen_pride-and-prejudice/master/src/epub/text/chapter-1.xhtml'
      )
    ).toEqual({
      hostRepo: 'raw.githubusercontent.com/standardebooks/jane-austen_pride-and-prejudice',
      name: 'Standard Ebooks (GitHub mirror)',
    });

    expect(
      describeSource('https://raw.githubusercontent.com/GITenberg/Pride-and-Prejudice_1342/master/1342.txt')
    ).toEqual({
      hostRepo: 'raw.githubusercontent.com/GITenberg/Pride-and-Prejudice_1342',
      name: 'Project Gutenberg (GITenberg mirror)',
    });
  });
});

describe('inject-excerpt: sliceExcerpt', () => {
  it('takes whole paragraphs until >= min, and stops at the last boundary before exceeding max', () => {
    const paragraphs = [
      placeholderParagraph('p1', 400),
      placeholderParagraph('p2', 400),
      placeholderParagraph('p3', 400),
      placeholderParagraph('p4', 400),
      placeholderParagraph('p5', 400),
    ];
    const text = paragraphs.join('\n\n');

    const { excerpt, wordCount } = sliceExcerpt(text, { min: 800, max: 1500 });

    // p1+p2+p3 = 1200 words (>= min); adding p4 would make 1600 (> max), so it stops there.
    expect(wordCount).toBe(1200);
    expect(excerpt).toBe(paragraphs.slice(0, 3).join('\n\n'));
    expect(excerpt).not.toContain('p4-word');
  });

  it('includes a single paragraph that alone exceeds max, when min has not yet been reached', () => {
    const hugeFirst = placeholderParagraph('huge', 2000);
    const text = [hugeFirst, placeholderParagraph('second', 100)].join('\n\n');

    const { excerpt, wordCount } = sliceExcerpt(text, { min: 800, max: 1500 });

    expect(wordCount).toBe(2000);
    expect(excerpt).toBe(hugeFirst);
  });

  it('honors --start to skip front matter and --end as a hard stop', () => {
    const paragraphs = [
      'Front matter paragraph mentioning nothing relevant at all here.',
      'CHAPTER ONE begins the real content right here for the reader.',
      'More real content in a second paragraph of the chapter body.',
      'THE END marker paragraph that should never be included in output.',
      'Back matter after the end, also never included in the output.',
    ];
    const text = paragraphs.join('\n\n');

    const { excerpt, wordCount } = sliceExcerpt(text, {
      min: 1,
      max: 1000,
      start: 'CHAPTER ONE',
      end: 'THE END',
    });

    expect(excerpt).not.toContain('Front matter');
    expect(excerpt).not.toContain('Back matter');
    expect(excerpt).toContain('CHAPTER ONE');
    expect(excerpt).toContain('More real content');
    expect(wordCount).toBeGreaterThan(0);
  });

  it('throws when --start phrase is not found', () => {
    expect(() =>
      sliceExcerpt('Some paragraph.\n\nAnother paragraph.', { start: 'NOWHERE TO BE FOUND' })
    ).toThrow(/--start phrase not found/);
  });
});

describe('inject-excerpt: parseArguments', () => {
  it('collects repeated --url flags in order and parses numeric/mode flags', () => {
    const opts = parseArguments([
      '--id',
      'some-work-2020',
      '--url',
      'https://example.com/a.xhtml',
      '--url',
      'https://example.com/b.xhtml',
      '--mode',
      'full',
      '--min',
      '900',
      '--max',
      '1600',
      '--start',
      'begin here',
      '--end',
      'stop here',
      '--dir',
      '/tmp/works',
    ]);

    expect(opts).toEqual({
      id: 'some-work-2020',
      urls: ['https://example.com/a.xhtml', 'https://example.com/b.xhtml'],
      mode: 'full',
      min: 900,
      max: 1600,
      start: 'begin here',
      end: 'stop here',
      dir: '/tmp/works',
    });
  });

  it('defaults mode/min/max when not given', () => {
    const opts = parseArguments(['--id', 'x', '--url', 'https://example.com/a.xhtml']);
    expect(opts).toMatchObject({ mode: 'excerpt', min: 800, max: 1500 });
  });
});

describe('inject-excerpt: injectExcerpt (mocked fetch, temp works dir)', () => {
  let dir: string;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const root = await mkdtemp(join(tmpdir(), 'well-read-inject-excerpt-'));
    dir = join(root, 'works');
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    fetchSpy?.mockRestore();
    await rm(dir, { recursive: true, force: true });
  });

  async function writeWork(work: Record<string, unknown>) {
    await writeFile(join(dir, `${work.id}.json`), JSON.stringify(work, null, 2));
  }

  it('excerpt mode: writes excerpt/excerptNote, updates source, preserves other fields and key order', async () => {
    const work = makeExcerptWork();
    await writeWork(work);

    const bigParagraphs = Array.from({ length: 6 }, (_, i) => placeholderParagraph(`para${i}`, 300));
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(`<html><body>${bigParagraphs.map((p) => `<p>${p}</p>`).join('')}</body></html>`, {
          status: 200,
        })
      );

    const url = 'https://raw.githubusercontent.com/standardebooks/some-book/master/src/epub/text/chapter-1.xhtml';
    const result = await injectExcerpt({
      id: 'fixture-inject-excerpt-work-2020',
      urls: [url],
      dir,
      min: 800,
      max: 1500,
      now: new Date('2026-09-13T00:00:00Z'),
    });

    expect(result.mode).toBe('excerpt');
    expect(result.excerptWordCount).toBeGreaterThanOrEqual(800);
    expect(result.excerptWordCount).toBeLessThanOrEqual(1500);

    const onDisk = JSON.parse(await readFile(join(dir, 'fixture-inject-excerpt-work-2020.json'), 'utf8'));

    expect(onDisk.excerpt).not.toContain('seed-word'); // old placeholder gone
    expect(onDisk.excerpt).toContain('para0-word');
    expect(onDisk.excerptNote).toMatch(
      /^Opening \d+ words of \d+ \(source: raw\.githubusercontent\.com\/standardebooks\/some-book\)$/
    );
    expect(onDisk.source).toEqual({
      name: 'Standard Ebooks (GitHub mirror)',
      url,
      license: 'public-domain', // untouched
      retrievedDate: '2026-09-13',
    });

    // Untouched fields survive as-is.
    expect(onDisk.title).toBe(work.title);
    expect(onDisk.masterNotes).toEqual(work.masterNotes);

    // Key order preserved: id is still first.
    expect(Object.keys(onDisk)[0]).toBe('id');
  });

  it('does not re-stamp source when source.url already matches the fetched URL', async () => {
    const url = 'https://raw.githubusercontent.com/standardebooks/some-book/master/src/epub/text/chapter-1.xhtml';
    const work = makeExcerptWork({
      source: {
        name: 'Already Set',
        url,
        license: 'cc0',
        retrievedDate: '2020-01-01',
      },
    });
    await writeWork(work);

    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(`<p>${placeholderParagraph('body', 900)}</p>`, { status: 200 }));

    await injectExcerpt({ id: work.id as string, urls: [url], dir, min: 500, max: 1500 });

    const onDisk = JSON.parse(await readFile(join(dir, `${work.id}.json`), 'utf8'));
    expect(onDisk.source).toEqual({
      name: 'Already Set',
      url,
      license: 'cc0',
      retrievedDate: '2020-01-01',
    });
  });

  it('full mode: writes `text`, removes excerpt/excerptNote, concatenates multiple URLs in order', async () => {
    const work = makeFullWork();
    await writeWork(work);

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('part1.xhtml')) {
        return new Response('<p>first part placeholder text</p>', { status: 200 });
      }
      return new Response('<p>second part placeholder text</p>', { status: 200 });
    });

    const urls = [
      'https://raw.githubusercontent.com/GITenberg/some-book/master/part1.xhtml',
      'https://raw.githubusercontent.com/GITenberg/some-book/master/part2.xhtml',
    ];
    const result = await injectExcerpt({ id: work.id as string, urls, dir, mode: 'full' });

    expect(result.mode).toBe('full');
    expect(result.excerptWordCount).toBeNull();

    const onDisk = JSON.parse(await readFile(join(dir, `${work.id}.json`), 'utf8'));
    expect(onDisk.text).toBe('first part placeholder text\n\nsecond part placeholder text');
    expect(onDisk).not.toHaveProperty('excerpt');
    expect(onDisk).not.toHaveProperty('excerptNote');
    expect(onDisk.source.name).toBe('Project Gutenberg (GITenberg mirror)');
  });

  it('refuses to write when the result would fail WorkSchema validation, leaving the file untouched', async () => {
    const work = makeExcerptWork();
    await writeWork(work);
    const before = await readFile(join(dir, `${work.id}.json`), 'utf8');

    // Too short to clear the 500-word prose excerpt floor.
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<p>Only a few placeholder words here.</p>', { status: 200 }));

    await expect(
      injectExcerpt({
        id: work.id as string,
        urls: ['https://raw.githubusercontent.com/standardebooks/some-book/master/chapter-1.xhtml'],
        dir,
        min: 800,
        max: 1500,
      })
    ).rejects.toThrow(/failed WorkSchema validation/);

    const after = await readFile(join(dir, `${work.id}.json`), 'utf8');
    expect(after).toBe(before);
  });

  it('rejects an unknown --mode without fetching anything', async () => {
    const work = makeExcerptWork();
    await writeWork(work);
    fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      injectExcerpt({ id: work.id as string, urls: ['https://example.com/x.xhtml'], dir, mode: 'bogus' })
    ).rejects.toThrow(/--mode must be/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
