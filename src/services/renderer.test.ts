import test from 'ava';
import { renderDocument, renderDocumentContent } from './renderer.js';
import type { LeafletPage } from '../types/leaflet.js';

// renderDocument tests
test('renderDocument › should render a simple text block', t => {
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
  t.true(html.includes('<p>Hello, world!</p>'));
});

test('renderDocument › should escape HTML in text to prevent XSS', t => {
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
  t.false(html.includes('<script>'));
  t.true(html.includes('&lt;script&gt;'));
});

test('renderDocument › should render header blocks with correct levels', t => {
  const pages: LeafletPage[] = [{
    $type: 'pub.leaflet.pages.linearDocument',
    blocks: [
      { block: { $type: 'pub.leaflet.blocks.header', level: 1, plaintext: 'H1 Title' } },
      { block: { $type: 'pub.leaflet.blocks.header', level: 2, plaintext: 'H2 Title' } },
      { block: { $type: 'pub.leaflet.blocks.header', level: 3, plaintext: 'H3 Title' } }
    ]
  }];

  const html = renderDocument(pages);
  t.true(html.includes('<h1>H1 Title</h1>'));
  t.true(html.includes('<h2>H2 Title</h2>'));
  t.true(html.includes('<h3>H3 Title</h3>'));
});

test('renderDocument › should clamp header levels to valid range (1-6)', t => {
  const pages: LeafletPage[] = [{
    $type: 'pub.leaflet.pages.linearDocument',
    blocks: [
      { block: { $type: 'pub.leaflet.blocks.header', level: 0, plaintext: 'Too Low' } },
      { block: { $type: 'pub.leaflet.blocks.header', level: 10, plaintext: 'Too High' } }
    ]
  }];

  const html = renderDocument(pages);
  t.true(html.includes('<h1>Too Low</h1>'));
  t.true(html.includes('<h6>Too High</h6>'));
});

test('renderDocument › should render blockquotes', t => {
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
  t.true(html.includes('<blockquote>A wise quote</blockquote>'));
});

test('renderDocument › should render horizontal rules', t => {
  const pages: LeafletPage[] = [{
    $type: 'pub.leaflet.pages.linearDocument',
    blocks: [{
      block: { $type: 'pub.leaflet.blocks.horizontalRule' }
    }]
  }];

  const html = renderDocument(pages);
  t.true(html.includes('<hr>'));
});

test('renderDocument › should render code blocks with language class', t => {
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
  t.true(html.includes('<pre><code class="language-javascript">const x = 1;</code></pre>'));
});

test('renderDocument › should escape HTML in code blocks', t => {
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
  t.true(html.includes('&lt;div&gt;Not HTML&lt;/div&gt;'));
});

test('renderDocument › should render unordered lists', t => {
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
  t.true(html.includes('<ul>'));
  t.true(html.includes('<li>First item</li>'));
  t.true(html.includes('<li>Second item</li>'));
  t.true(html.includes('<li>Third item</li>'));
  t.true(html.includes('</ul>'));
});

test('renderDocument › should render nested lists', t => {
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
  t.true(html.includes('<li>Parent<ul>'));
  t.true(html.includes('<li>Child 1</li>'));
  t.true(html.includes('<li>Child 2</li>'));
});

test('renderDocument › should render empty paragraphs as non-breaking space', t => {
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
  t.true(html.includes('<p>&nbsp;</p>'));
});

test('renderDocument › should render image placeholders', t => {
  const pages: LeafletPage[] = [{
    $type: 'pub.leaflet.pages.linearDocument',
    blocks: [{
      block: {
        $type: 'pub.leaflet.blocks.image',
        image: { $type: 'blob', ref: { $link: 'bafybeig...' }, mimeType: 'image/png', size: 1234 },
        alt: 'Test image',
        caption: 'A test caption'
      }
    }]
  }];

  const html = renderDocument(pages);
  t.true(html.includes('[Image: Test image]'));
  t.true(html.includes('<figcaption>A test caption</figcaption>'));
});

// Alignment handling tests
test('Alignment handling › should apply valid alignment styles', t => {
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
  t.true(html.includes('style="text-align: left"'));
  t.true(html.includes('style="text-align: center"'));
  t.true(html.includes('style="text-align: right"'));
  t.true(html.includes('style="text-align: justify"'));
});

test('Alignment handling › should ignore invalid alignment values (XSS prevention)', t => {
  const pages: LeafletPage[] = [{
    $type: 'pub.leaflet.pages.linearDocument',
    blocks: [{
      block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Test' },
      alignment: 'left"; onmouseover="alert(1)"' as 'left'
    }]
  }];

  const html = renderDocument(pages);
  t.false(html.includes('onmouseover'));
  t.false(html.includes('alert'));
  t.is(html, '<p>Test</p>');
});

// Facets (rich text) tests
test('Facets › should apply bold formatting', t => {
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
  t.true(html.includes('Hello <strong>bold</strong> world'));
});

test('Facets › should apply italic formatting', t => {
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
  t.true(html.includes('Hello <em>italic</em> world'));
});

test('Facets › should apply strikethrough formatting', t => {
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
  t.true(html.includes('Hello <del>deleted</del> world'));
});

test('Facets › should apply link formatting with valid URLs', t => {
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
  t.true(html.includes('<a href="https://example.com" target="_blank" rel="noopener noreferrer">here</a>'));
});

test('Facets › should reject invalid link URLs (javascript:)', t => {
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
  t.false(html.includes('javascript:'));
  t.false(html.includes('<a'));
  t.true(html.includes('here'));
});

test('Facets › should apply mention formatting', t => {
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
  t.true(html.includes('https://bsky.app/profile/did:plc:alice123'));
  t.true(html.includes('@alice'));
});

test('Facets › should apply multiple facets correctly', t => {
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
  t.true(html.includes('<strong>Bold</strong>'));
  t.true(html.includes('<em>italic</em>'));
});

test('Facets › should handle multiple features on same segment', t => {
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
  t.true(html.includes('<strong>'));
  t.true(html.includes('<em>'));
  // Features are applied in order: bold first wraps the text, then italic wraps the result
  t.true(html.includes('Bold italic</strong></em>'));
});

test('Facets › should handle unicode characters with byte indices correctly', t => {
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
  t.true(html.includes('<strong>world</strong>'));
});

test('Facets › should skip facets with invalid byte indices', t => {
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
  t.true(html.includes('Short'));
  t.false(html.includes('<strong>'));
});

// Bluesky post embeds tests
test('Bluesky post embeds › should render valid bsky post links', t => {
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
  t.true(html.includes('bsky.app/profile/did%3Aplc%3Aabc123/post/xyz789'));
});

test('Bluesky post embeds › should reject invalid DIDs in bsky post blocks', t => {
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
  t.true(html.includes('[Invalid Bluesky post reference]'));
});

// Website blocks tests
test('Website blocks › should render website links', t => {
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
  t.true(html.includes('href="https://example.com"'));
  t.true(html.includes('Example Site'));
  t.true(html.includes('An example website'));
});

test('Website blocks › should reject invalid URLs in website blocks', t => {
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
  t.true(html.includes('[Invalid URL]'));
});

// Multi-page documents tests
test('Multi-page documents › should wrap multiple pages in sections', t => {
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
  t.true(html.includes('<section class="page" data-page="1">'));
  t.true(html.includes('<section class="page" data-page="2">'));
});

test('Multi-page documents › should not wrap single page in section', t => {
  const pages: LeafletPage[] = [{
    $type: 'pub.leaflet.pages.linearDocument',
    blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Only page' } }]
  }];

  const html = renderDocument(pages);
  t.false(html.includes('<section'));
});

// renderDocumentContent tests
test('renderDocumentContent › should parse JSON and render document', t => {
  const json = JSON.stringify([{
    $type: 'pub.leaflet.pages.linearDocument',
    blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'From JSON' } }]
  }]);

  const html = renderDocumentContent(json);
  t.true(html.includes('<p>From JSON</p>'));
});

test('renderDocumentContent › should handle invalid JSON gracefully', t => {
  const html = renderDocumentContent('not valid json');
  t.true(html.includes('Error rendering document content'));
});
