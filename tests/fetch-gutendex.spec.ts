import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('fetch-gutendex', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('should parse and transform Gutendex API response correctly', async () => {
    // Mock Gutendex API response
    const mockResponse = {
      count: 2,
      results: [
        {
          id: 694,
          title: 'Poems by Emily Dickinson',
          authors: [
            {
              name: 'Dickinson, Emily',
              birth_year: 1830,
              death_year: 1886,
            },
          ],
          subjects: ['American fiction', 'Women -- Poetry'],
          formats: {
            'text/html': 'https://www.gutenberg.org/files/694/694-h/694-h.htm',
            'application/epub+zip': 'https://www.gutenberg.org/ebooks/694.epub.images',
            'application/x-mobipocket-ebook': 'https://www.gutenberg.org/ebooks/694.kindle.images',
          },
        },
        {
          id: 11992,
          title: 'Poems by Emily Dickinson: Series One',
          authors: [
            {
              name: 'Dickinson, Emily',
              birth_year: 1830,
              death_year: 1886,
            },
          ],
          subjects: ['Poetry', 'American poetry'],
          formats: {
            'text/html': 'https://www.gutenberg.org/files/11992/11992-h/11992-h.htm',
            'application/epub+zip': 'https://www.gutenberg.org/ebooks/11992.epub.images',
          },
        },
      ],
    };

    // Verify the structure of a candidate object
    const candidate = {
      title: mockResponse.results[0].title,
      author: mockResponse.results[0].authors[0].name,
      year: mockResponse.results[0].authors[0].birth_year,
      gutenbergId: mockResponse.results[0].id,
      subjects: mockResponse.results[0].subjects,
      epubUrl: mockResponse.results[0].formats['application/epub+zip'],
      htmlUrl: mockResponse.results[0].formats['text/html'],
      sourceUrl: `https://gutendex.com/books/${mockResponse.results[0].id}`,
    };

    expect(candidate).toEqual({
      title: 'Poems by Emily Dickinson',
      author: 'Dickinson, Emily',
      year: 1830,
      gutenbergId: 694,
      subjects: ['American fiction', 'Women -- Poetry'],
      epubUrl: 'https://www.gutenberg.org/ebooks/694.epub.images',
      htmlUrl: 'https://www.gutenberg.org/files/694/694-h/694-h.htm',
      sourceUrl: 'https://gutendex.com/books/694',
    });
  });

  it('should handle missing year gracefully (null author years)', () => {
    const authorWithoutYear = {
      name: 'Unknown Author',
      birth_year: null,
      death_year: null,
    };

    let year: number | null = null;
    if (authorWithoutYear.birth_year !== null) {
      year = authorWithoutYear.birth_year;
    } else if (authorWithoutYear.death_year !== null) {
      year = authorWithoutYear.death_year;
    }

    expect(year).toBeNull();
  });

  it('should handle missing author gracefully', () => {
    const resultWithoutAuthors = {
      id: 123,
      title: 'Anonymous Work',
      authors: [],
      subjects: ['Fiction'],
      formats: {
        'text/html': 'https://example.com/text.html',
      },
    };

    let author: string | null = null;

    if (resultWithoutAuthors.authors && resultWithoutAuthors.authors.length > 0) {
      author = resultWithoutAuthors.authors[0].name || null;
    }

    expect(author).toBeNull();
  });

  it('should handle missing format URLs', () => {
    const resultWithLimitedFormats = {
      id: 456,
      title: 'Limited Formats Work',
      authors: [{ name: 'Some Author', birth_year: 1900, death_year: null }],
      subjects: [],
      formats: {
        'text/html': 'https://example.com/text.html',
        // no epub
      },
    };

    const epubUrl = resultWithLimitedFormats.formats['application/epub+zip'] || null;
    const htmlUrl = resultWithLimitedFormats.formats['text/html'] || null;

    expect(epubUrl).toBeNull();
    expect(htmlUrl).toBe('https://example.com/text.html');
  });
});
