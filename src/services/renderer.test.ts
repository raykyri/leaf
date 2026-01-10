import { describe, it, expect } from 'vitest';
import { renderDocument, renderDocumentContent } from './renderer.js';
import type { LinearDocumentPage, LeafletPage } from '../types/leaflet.js';

describe('Renderer', () => {
  describe('renderDocument', () => {
    it('should render a simple text block', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Hello, world!'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<p>Hello, world!</p>');
    });

    it('should escape HTML in text to prevent XSS', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: '<script>alert("xss")</script>'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should render header blocks with correct levels', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [
          { block: { $type: 'pub.leaflet.blocks.header', level: 1, plaintext: 'H1 Title' } },
          { block: { $type: 'pub.leaflet.blocks.header', level: 2, plaintext: 'H2 Title' } },
          { block: { $type: 'pub.leaflet.blocks.header', level: 3, plaintext: 'H3 Title' } }
        ]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<h1>H1 Title</h1>');
      expect(html).toContain('<h2>H2 Title</h2>');
      expect(html).toContain('<h3>H3 Title</h3>');
    });

    it('should clamp header levels to valid range (1-6)', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [
          { block: { $type: 'pub.leaflet.blocks.header', level: 0, plaintext: 'Too Low' } },
          { block: { $type: 'pub.leaflet.blocks.header', level: 10, plaintext: 'Too High' } }
        ]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<h1>Too Low</h1>');
      expect(html).toContain('<h6>Too High</h6>');
    });

    it('should render blockquotes', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.blockquote',
            plaintext: 'A wise quote'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<blockquote>A wise quote</blockquote>');
    });

    it('should render horizontal rules', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: { $type: 'pub.leaflet.blocks.horizontalRule' }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<hr>');
    });

    it('should render code blocks with language class', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.code',
            plaintext: 'const x = 1;',
            language: 'javascript'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<pre><code class="language-javascript">const x = 1;</code></pre>');
    });

    it('should escape HTML in code blocks', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.code',
            plaintext: '<div>Not HTML</div>'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('&lt;div&gt;Not HTML&lt;/div&gt;');
    });

    it('should render unordered lists', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.unorderedList',
            items: [
              { content: { $type: 'pub.leaflet.blocks.text', plaintext: 'First item' } },
              { content: { $type: 'pub.leaflet.blocks.text', plaintext: 'Second item' } },
              { content: { $type: 'pub.leaflet.blocks.text', plaintext: 'Third item' } }
            ]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>First item</li>');
      expect(html).toContain('<li>Second item</li>');
      expect(html).toContain('<li>Third item</li>');
      expect(html).toContain('</ul>');
    });

    it('should render nested lists', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.unorderedList',
            items: [{
              content: { $type: 'pub.leaflet.blocks.text', plaintext: 'Parent' },
              children: [
                { content: { $type: 'pub.leaflet.blocks.text', plaintext: 'Child 1' } },
                { content: { $type: 'pub.leaflet.blocks.text', plaintext: 'Child 2' } }
              ]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<li>Parent<ul>');
      expect(html).toContain('<li>Child 1</li>');
      expect(html).toContain('<li>Child 2</li>');
    });

    it('should render empty paragraphs as non-breaking space', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: ''
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<p>&nbsp;</p>');
    });

    it('should render image placeholders', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.image',
            image: { ref: { $link: 'bafybeig...' }, mimeType: 'image/png', size: 1234 },
            alt: 'Test image',
            caption: 'A test caption'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('[Image: Test image]');
      expect(html).toContain('<figcaption>A test caption</figcaption>');
    });
  });

  describe('Alignment handling', () => {
    it('should apply valid alignment styles', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [
          { block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Left' }, alignment: 'left' },
          { block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Center' }, alignment: 'center' },
          { block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Right' }, alignment: 'right' },
          { block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Justify' }, alignment: 'justify' }
        ]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('style="text-align: left"');
      expect(html).toContain('style="text-align: center"');
      expect(html).toContain('style="text-align: right"');
      expect(html).toContain('style="text-align: justify"');
    });

    it('should ignore invalid alignment values (XSS prevention)', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Test' },
          alignment: 'left"; onmouseover="alert(1)"' as 'left'
        }]
      }];

      const html = renderDocument(pages);
      expect(html).not.toContain('onmouseover');
      expect(html).not.toContain('alert');
      expect(html).toBe('<p>Test</p>');
    });
  });

  describe('Facets (rich text)', () => {
    it('should apply bold formatting', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Hello bold world',
            facets: [{
              index: { byteStart: 6, byteEnd: 10 },
              features: [{ $type: 'pub.leaflet.richtext.facet#bold' }]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('Hello <strong>bold</strong> world');
    });

    it('should apply italic formatting', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Hello italic world',
            facets: [{
              index: { byteStart: 6, byteEnd: 12 },
              features: [{ $type: 'pub.leaflet.richtext.facet#italic' }]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('Hello <em>italic</em> world');
    });

    it('should apply strikethrough formatting', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Hello deleted world',
            facets: [{
              index: { byteStart: 6, byteEnd: 13 },
              features: [{ $type: 'pub.leaflet.richtext.facet#strikethrough' }]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('Hello <del>deleted</del> world');
    });

    it('should apply link formatting with valid URLs', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Click here for more',
            facets: [{
              index: { byteStart: 6, byteEnd: 10 },
              features: [{
                $type: 'pub.leaflet.richtext.facet#link',
                uri: 'https://example.com'
              }]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">here</a>');
    });

    it('should reject invalid link URLs (javascript:)', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Click here',
            facets: [{
              index: { byteStart: 6, byteEnd: 10 },
              features: [{
                $type: 'pub.leaflet.richtext.facet#link',
                uri: 'javascript:alert(1)'
              }]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('<a');
      expect(html).toContain('here');
    });

    it('should apply mention formatting', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Hello @alice there',
            facets: [{
              index: { byteStart: 6, byteEnd: 12 },
              features: [{
                $type: 'pub.leaflet.richtext.facet#mention',
                did: 'did:plc:alice123'
              }]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('https://bsky.app/profile/did:plc:alice123');
      expect(html).toContain('@alice');
    });

    it('should apply multiple facets correctly', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Bold and italic text',
            facets: [
              {
                index: { byteStart: 0, byteEnd: 4 },
                features: [{ $type: 'pub.leaflet.richtext.facet#bold' }]
              },
              {
                index: { byteStart: 9, byteEnd: 15 },
                features: [{ $type: 'pub.leaflet.richtext.facet#italic' }]
              }
            ]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<strong>Bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });

    it('should handle multiple features on same segment', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Bold italic text',
            facets: [{
              index: { byteStart: 0, byteEnd: 11 },
              features: [
                { $type: 'pub.leaflet.richtext.facet#bold' },
                { $type: 'pub.leaflet.richtext.facet#italic' }
              ]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
      // Features are applied in order: bold first wraps the text, then italic wraps the result
      expect(html).toContain('Bold italic</strong></em>');
    });

    it('should handle unicode characters with byte indices correctly', () => {
      // "Hello 🌍 world" - emoji is 4 bytes
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Hello 🌍 world',
            facets: [{
              index: { byteStart: 11, byteEnd: 16 }, // "world" after 4-byte emoji
              features: [{ $type: 'pub.leaflet.richtext.facet#bold' }]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('<strong>world</strong>');
    });

    it('should skip facets with invalid byte indices', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'Short',
            facets: [{
              index: { byteStart: 0, byteEnd: 100 }, // Beyond string length
              features: [{ $type: 'pub.leaflet.richtext.facet#bold' }]
            }]
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('Short');
      expect(html).not.toContain('<strong>');
    });
  });

  describe('Bluesky post embeds', () => {
    it('should render valid bsky post links', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.bskyPost',
            uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('bsky.app/profile/did%3Aplc%3Aabc123/post/xyz789');
    });

    it('should reject invalid DIDs in bsky post blocks', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.bskyPost',
            uri: 'at://invalid-did/app.bsky.feed.post/xyz789'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('[Invalid Bluesky post reference]');
    });
  });

  describe('Website blocks', () => {
    it('should render website links', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.website',
            url: 'https://example.com',
            title: 'Example Site',
            description: 'An example website'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('Example Site');
      expect(html).toContain('An example website');
    });

    it('should reject invalid URLs in website blocks', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.website',
            url: 'javascript:alert(1)'
          }
        }]
      }];

      const html = renderDocument(pages);
      expect(html).toContain('[Invalid URL]');
    });
  });

  describe('Multi-page documents', () => {
    it('should wrap multiple pages in sections', () => {
      const pages: LeafletPage[] = [
        {
          $type: 'pub.leaflet.pages.linearDocument',
          blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Page 1' } }]
        },
        {
          $type: 'pub.leaflet.pages.linearDocument',
          blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Page 2' } }]
        }
      ];

      const html = renderDocument(pages);
      expect(html).toContain('<section class="page" data-page="1">');
      expect(html).toContain('<section class="page" data-page="2">');
    });

    it('should not wrap single page in section', () => {
      const pages: LeafletPage[] = [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Only page' } }]
      }];

      const html = renderDocument(pages);
      expect(html).not.toContain('<section');
    });
  });

  describe('renderDocumentContent', () => {
    it('should parse JSON and render document', () => {
      const json = JSON.stringify([{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'From JSON' } }]
      }]);

      const html = renderDocumentContent(json);
      expect(html).toContain('<p>From JSON</p>');
    });

    it('should handle invalid JSON gracefully', () => {
      const html = renderDocumentContent('not valid json');
      expect(html).toContain('Error rendering document content');
    });
  });
});
