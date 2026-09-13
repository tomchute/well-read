import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeSource,
  gutenbergToText,
  injectExcerpt,
  parseArguments,
  plainTextToText,
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
  const baseWork = makeExcerptWork(overrides);
  return {
    ...baseWork,
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
    expect(result).toContain(
      'Second paragraph with extra spacing and an & entity, an — dash, and a ’quote’.'
    );

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

  it('gutenbergToText handles the old-style "START OF THIS PROJECT GUTENBERG EBOOK" marker (front matter kept, sliced later by --start)', () => {
    const raw = [
      "Project Gutenberg's A Placeholder Title, by A Placeholder Author",
      '',
      '*** START OF THIS PROJECT GUTENBERG EBOOK A PLACEHOLDER TITLE ***',
      '',
      'Produced by A Placeholder Contributor.',
      '',
      'Placeholder Contents heading paragraph goes here for testing.',
      '',
      '*** END OF THIS PROJECT GUTENBERG EBOOK A PLACEHOLDER TITLE ***',
      '',
      'End of Project Gutenberg boilerplate footer text placeholder.',
    ].join('\n');

    const result = gutenbergToText(raw);

    expect(result).not.toContain("Project Gutenberg's A Placeholder Title");
    expect(result).not.toContain('End of Project Gutenberg boilerplate');
    expect(result).toContain('Produced by A Placeholder Contributor.');
    expect(result).toContain('Placeholder Contents heading paragraph');
  });

  it('gutenbergToText preserves verse line breaks in an indented (poem) block but still reflows flush-left prose', () => {
    const raw = [
      '*** START OF THE PROJECT GUTENBERG EBOOK A PLACEHOLDER TITLE ***',
      '',
      '  Placeholder verse line one of the stanza,',
      '    placeholder verse line two indented further,',
      '  placeholder verse line three closing the stanza.',
      '',
      'This is a flush-left placeholder paragraph that wraps',
      'across two lines of hard-wrapped prose for testing.',
      '',
      '*** END OF THE PROJECT GUTENBERG EBOOK A PLACEHOLDER TITLE ***',
    ].join('\n');

    const result = gutenbergToText(raw);
    const paragraphs = result.split('\n\n');

    const versePara = paragraphs.find((p) => p.includes('verse line one'));
    expect(versePara?.split('\n')).toEqual([
      'Placeholder verse line one of the stanza,',
      'placeholder verse line two indented further,',
      'placeholder verse line three closing the stanza.',
    ]);

    const prosePara = paragraphs.find((p) => p.includes('flush-left placeholder'));
    expect(prosePara).toBe(
      'This is a flush-left placeholder paragraph that wraps across two lines of hard-wrapped prose for testing.'
    );
  });

  it('gutenbergToText handles the old pre-1997 "*END*THE SMALL PRINT" header style', () => {
    const raw = [
      'The Project Gutenberg Etext of A Placeholder Title',
      '',
      '**Welcome To The World of Free Plain Vanilla Electronic Texts**',
      '',
      '*END*THE SMALL PRINT! FOR PUBLIC DOMAIN ETEXTS*Ver.04.29.93*END*',
      '',
      'Placeholder first paragraph of the actual placeholder content.',
      '',
      'Placeholder second paragraph of the actual placeholder content.',
    ].join('\n');

    const result = gutenbergToText(raw);

    expect(result).not.toContain('Welcome To The World');
    expect(result).not.toContain('SMALL PRINT');
    expect(result).toContain('Placeholder first paragraph of the actual placeholder content.');
    expect(result).toContain('Placeholder second paragraph of the actual placeholder content.');
  });

  it('plainTextToText preserves verse line breaks and splits on blank lines', () => {
    const plainText = [
      'First placeholder line of verse',
      'Second placeholder line of verse',
      'Third placeholder line of verse',
      '',
      'Second paragraph placeholder text.',
      'Also second paragraph.',
    ].join('\n');

    const result = plainTextToText(plainText);

    const paragraphs = result.split('\n\n');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe(
      'First placeholder line of verse\nSecond placeholder line of verse\nThird placeholder line of verse'
    );
    expect(paragraphs[1]).toBe('Second paragraph placeholder text.\nAlso second paragraph.');
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
      describeSource(
        'https://raw.githubusercontent.com/GITenberg/Pride-and-Prejudice_1342/master/1342.txt'
      )
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

  it('locates --start/--end phrases hard-wrapped across a line break, without altering the stored paragraph text', () => {
    const paragraphs = [
      'Front matter paragraph that is not relevant to the excerpt at all.',
      'This placeholder phrase wraps across a line\nbreak in the source file.',
      'Middle paragraph that should be included in the sliced excerpt text.',
      'This is the end phrase wrapped across a\nline in the source as well.',
      'Trailing paragraph that must never appear in the sliced excerpt output.',
    ];
    const text = paragraphs.join('\n\n');

    const { excerpt } = sliceExcerpt(text, {
      min: 1,
      max: 1000,
      start: 'phrase wraps across a line break',
      end: 'end phrase wrapped across a line',
    });

    // The line break inside the matched paragraph is preserved verbatim.
    expect(excerpt).toContain(
      'This placeholder phrase wraps across a line\nbreak in the source file.'
    );
    expect(excerpt).toContain('Middle paragraph');
    expect(excerpt).not.toContain('Front matter');
    expect(excerpt).not.toContain('Trailing paragraph');
  });

  it('drops trailing heading-like paragraphs left over when --end matches a phrase in the next section', () => {
    const paragraphs = [
      'IV',
      'Placeholder first line of the target section content here now.',
      'Placeholder second line finishing off the target section body.',
      'V',
      'Placeholder first line of the next section that follows after.',
    ];
    const text = paragraphs.join('\n\n');

    const { excerpt } = sliceExcerpt(text, {
      min: 1,
      max: 1000,
      start: 'Placeholder first line of the target',
      end: 'Placeholder first line of the next section',
    });

    expect(excerpt).toBe(
      [
        'Placeholder first line of the target section content here now.',
        'Placeholder second line finishing off the target section body.',
      ].join('\n\n')
    );
  });

  it('drops a leading heading-like paragraph when no --start is given to skip past it', () => {
    const paragraphs = [
      'I',
      'Placeholder content paragraph that should remain in the excerpt text.',
      'Second placeholder paragraph that should also remain in the excerpt.',
      'Trailing paragraph that must never appear in the sliced excerpt output.',
    ];
    const text = paragraphs.join('\n\n');

    const { excerpt } = sliceExcerpt(text, {
      min: 1,
      max: 1000,
      end: 'Trailing paragraph that must never appear',
    });

    expect(excerpt.split('\n\n')[0]).not.toBe('I');
    expect(excerpt).not.toContain('Trailing paragraph');
    expect(excerpt).toBe(
      [
        'Placeholder content paragraph that should remain in the excerpt text.',
        'Second placeholder paragraph that should also remain in the excerpt.',
      ].join('\n\n')
    );
  });

  it('strips a numeral/roman-numeral prefix glued to the front of the start paragraph', () => {
    const paragraphs = [
      'Front matter paragraph unrelated to the target section entirely here.',
      'II Placeholder poem opening line that follows the section numeral directly.',
      'Second line of the placeholder poem section content for testing purposes.',
    ];
    const text = paragraphs.join('\n\n');

    const { excerpt } = sliceExcerpt(text, {
      min: 1,
      max: 1000,
      start: 'Placeholder poem opening line',
    });

    expect(excerpt.startsWith('Placeholder poem opening line')).toBe(true);
    expect(excerpt).not.toContain('II Placeholder');
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
      files: [],
      mode: 'full',
      min: 900,
      max: 1600,
      start: 'begin here',
      end: 'stop here',
      dir: '/tmp/works',
    });
  });

  it('collects repeated --file flags separately from --url', () => {
    const opts = parseArguments([
      '--id',
      'some-work-2020',
      '--file',
      '/tmp/part1.txt',
      '--file',
      '/tmp/part2.txt',
    ]);

    expect(opts).toEqual({
      id: 'some-work-2020',
      urls: [],
      files: ['/tmp/part1.txt', '/tmp/part2.txt'],
      mode: 'excerpt',
      min: 800,
      max: 1500,
      start: null,
      end: null,
      dir: null,
    });
  });

  it('defaults mode/min/max when not given', () => {
    const opts = parseArguments(['--id', 'x', '--url', 'https://example.com/a.xhtml']);
    expect(opts).toMatchObject({ mode: 'excerpt', min: 800, max: 1500, files: [] });
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

    const bigParagraphs = Array.from({ length: 6 }, (_, i) =>
      placeholderParagraph(`para${i}`, 300)
    );
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        `<html><body>${bigParagraphs.map((p) => `<p>${p}</p>`).join('')}</body></html>`,
        {
          status: 200,
        }
      )
    );

    const url =
      'https://raw.githubusercontent.com/standardebooks/some-book/master/src/epub/text/chapter-1.xhtml';
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

    const onDisk = JSON.parse(
      await readFile(join(dir, 'fixture-inject-excerpt-work-2020.json'), 'utf8')
    );

    expect(onDisk.excerpt).not.toContain('seed-word'); // old placeholder gone
    expect(onDisk.excerpt).toContain('para0-word');
    expect(onDisk.excerptNote).toMatch(
      /^Opening \d+ words (of the work, ending at a paragraph break|: the complete first section as published) \(source: raw\.githubusercontent\.com\/standardebooks\/some-book\)$/
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
    const url =
      'https://raw.githubusercontent.com/standardebooks/some-book/master/src/epub/text/chapter-1.xhtml';
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
      .mockResolvedValue(
        new Response(`<p>${placeholderParagraph('body', 900)}</p>`, { status: 200 })
      );

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
      .mockResolvedValue(
        new Response('<p>Only a few placeholder words here.</p>', { status: 200 })
      );

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
      injectExcerpt({
        id: work.id as string,
        urls: ['https://example.com/x.xhtml'],
        dir,
        mode: 'bogus',
      })
    ).rejects.toThrow(/--mode must be/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects when both --url and --file are provided', async () => {
    const work = makeExcerptWork();
    await writeWork(work);

    await expect(
      injectExcerpt({
        id: work.id as string,
        urls: ['https://example.com/x.xhtml'],
        files: ['/tmp/some.txt'],
        dir,
      })
    ).rejects.toThrow(/--url and --file are mutually exclusive/);
  });

  it('full mode with plain-text file: writes whole text with verse line breaks preserved', async () => {
    const poemWork = {
      id: 'fixture-inject-poem-full-2020',
      type: 'poem',
      title: 'A Fixture Poem',
      author: 'Fixture Poet',
      year: 2020,
      era: 'contemporary',
      form: 'poem',
      themes: ['memory'],
      tags: ['fixture'],
      length: { unit: 'lines', value: 9 },
      difficulty: 2,
      source: {
        name: 'Placeholder Source',
        license: 'public-domain',
        retrievedDate: '2026-09-01',
      },
      textPolicy: 'full',
      text: 'TODO placeholder text.',
      ebookLinks: [{ provider: 'gutenberg', format: 'html', url: 'https://example.com/ebook' }],
      masterNotes: {
        context: 'Placeholder context.',
        form: 'Placeholder form discussion.',
        keyImages: ['Placeholder key image one.', 'Placeholder key image two.'],
        whatToNotice: ['Placeholder thing to notice.'],
        discussionQuestions: [
          'Placeholder question one?',
          'Placeholder question two?',
          'Placeholder question three?',
        ],
        furtherReading: ['Placeholder reference.'],
      },
      pipeline: {
        batchId: 'test-batch',
        dateAdded: '2026-09-01',
        curatedBy: 'test',
        schemaVersion: 1,
      },
    };
    await writeWork(poemWork);

    const plainTextFile = join(dir, 'poem.txt');
    const poemContent = [
      'First placeholder line',
      'Second placeholder line',
      'Third placeholder line',
      '',
      'Fourth placeholder line',
      'Fifth placeholder line',
      'Sixth placeholder line',
    ].join('\n');
    await writeFile(plainTextFile, poemContent);

    const result = await injectExcerpt({
      id: poemWork.id as string,
      files: [plainTextFile],
      dir,
      mode: 'full',
      now: new Date('2026-09-13T00:00:00Z'),
    });

    expect(result.mode).toBe('full');
    expect(result.excerptWordCount).toBeNull();

    const onDisk = JSON.parse(await readFile(join(dir, `${poemWork.id}.json`), 'utf8'));
    expect(onDisk.text).toContain('First placeholder line');
    expect(onDisk.text).toContain('Fifth placeholder line');
    expect(onDisk).not.toHaveProperty('excerpt');
    expect(onDisk.source.name).toBe('manual paste');
    expect(onDisk.source.retrievedDate).toBe('2026-09-13');
    // Verify verse lines are preserved
    expect(onDisk.text).toContain('\n');
  });

  it('excerpt mode with plain-text file: writes excerpt with source.name "manual paste"', async () => {
    const work = makeExcerptWork();
    await writeWork(work);

    const plainTextFile = join(dir, 'prose.txt');
    const proseContent = Array.from({ length: 6 }, (_, i) =>
      placeholderParagraph(`para${i}`, 300)
    ).join('\n\n');
    await writeFile(plainTextFile, proseContent);

    const result = await injectExcerpt({
      id: work.id as string,
      files: [plainTextFile],
      dir,
      min: 800,
      max: 1500,
      now: new Date('2026-09-13T00:00:00Z'),
    });

    expect(result.mode).toBe('excerpt');
    expect(result.excerptWordCount).toBeGreaterThanOrEqual(800);
    expect(result.excerptWordCount).toBeLessThanOrEqual(1500);

    const onDisk = JSON.parse(await readFile(join(dir, `${work.id}.json`), 'utf8'));
    expect(onDisk.excerpt).toBeDefined();
    expect(onDisk.excerptNote).toMatch(/source: manual paste/);
    expect(onDisk.source.name).toBe('manual paste');
    expect(onDisk.source.retrievedDate).toBe('2026-09-13');
  });
});
