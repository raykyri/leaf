import type {
  LeafletPage,
  LinearDocumentPage,
  Block,
  BlockWithAlignment,
  TextBlock,
  HeaderBlock,
  BlockquoteBlock,
  ImageBlock,
  UnorderedListBlock,
  CodeBlock,
  Facet,
  ListItem
} from '../types/leaflet.js';

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

// URL validation for safety
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Apply facets (rich text formatting) to text
function applyFacets(text: string, facets?: Facet[]): string {
  if (!facets || facets.length === 0) {
    return escapeHtml(text);
  }

  // Convert string to bytes for accurate slicing (ATProto uses byte indices)
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(text);

  // Sort facets by start position (ascending) for proper segment building
  const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

  // Build result by processing text segments between and within facets
  const segments: string[] = [];
  let lastEnd = 0;

  for (const facet of sortedFacets) {
    const { byteStart, byteEnd } = facet.index;

    // Validate byte indices
    if (byteStart < 0 || byteEnd > bytes.length || byteStart >= byteEnd) {
      continue;
    }

    // Add text before this facet (escaped)
    if (byteStart > lastEnd) {
      const beforeBytes = bytes.slice(lastEnd, byteStart);
      segments.push(escapeHtml(decoder.decode(beforeBytes)));
    }

    // Extract and process the faceted segment
    const segmentBytes = bytes.slice(byteStart, byteEnd);
    const segment = decoder.decode(segmentBytes);
    let wrapped = escapeHtml(segment);

    // Apply all features to this segment
    for (const feature of facet.features) {
      switch (feature.$type) {
        case 'pub.leaflet.richtext.facet#bold':
          wrapped = `<strong>${wrapped}</strong>`;
          break;
        case 'pub.leaflet.richtext.facet#italic':
          wrapped = `<em>${wrapped}</em>`;
          break;
        case 'pub.leaflet.richtext.facet#strikethrough':
          wrapped = `<del>${wrapped}</del>`;
          break;
        case 'pub.leaflet.richtext.facet#link':
          if (isValidUrl(feature.uri)) {
            wrapped = `<a href="${escapeHtml(feature.uri)}" target="_blank" rel="noopener noreferrer">${wrapped}</a>`;
          }
          break;
        case 'pub.leaflet.richtext.facet#mention':
          wrapped = `<a href="https://bsky.app/profile/${escapeHtml(feature.did)}" target="_blank" rel="noopener noreferrer">${wrapped}</a>`;
          break;
      }
    }

    segments.push(wrapped);
    lastEnd = byteEnd;
  }

  // Add any remaining text after the last facet
  if (lastEnd < bytes.length) {
    const afterBytes = bytes.slice(lastEnd);
    segments.push(escapeHtml(decoder.decode(afterBytes)));
  }

  return segments.join('');
}

// Validate alignment value against whitelist
function getAlignStyle(alignment?: string): string {
  const validAlignments = ['left', 'center', 'right', 'justify'];
  if (alignment && validAlignments.includes(alignment)) {
    return ` style="text-align: ${alignment}"`;
  }
  return '';
}

// Render a single block to HTML
function renderBlock(blockWithAlignment: BlockWithAlignment): string {
  const { block, alignment } = blockWithAlignment;
  const alignStyle = getAlignStyle(alignment);

  switch (block.$type) {
    case 'pub.leaflet.blocks.text':
      return renderTextBlock(block as TextBlock, alignStyle);

    case 'pub.leaflet.blocks.header':
      return renderHeaderBlock(block as HeaderBlock, alignStyle);

    case 'pub.leaflet.blocks.blockquote':
      return renderBlockquoteBlock(block as BlockquoteBlock, alignStyle);

    case 'pub.leaflet.blocks.image':
      return renderImageBlock(block as ImageBlock, alignStyle);

    case 'pub.leaflet.blocks.horizontalRule':
      return '<hr>';

    case 'pub.leaflet.blocks.unorderedList':
      return renderUnorderedListBlock(block as UnorderedListBlock);

    case 'pub.leaflet.blocks.code':
      return renderCodeBlock(block as CodeBlock);

    case 'pub.leaflet.blocks.iframe':
      // Skip iframes for security
      return '<p><em>[Embedded content not displayed]</em></p>';

    case 'pub.leaflet.blocks.website':
      return renderWebsiteBlock(block as { url: string; title?: string; description?: string });

    case 'pub.leaflet.blocks.bskyPost':
      return renderBskyPostBlock(block as { uri: string });

    default:
      // Unknown block type
      return `<p><em>[Unsupported content type: ${(block as Block).$type}]</em></p>`;
  }
}

function renderTextBlock(block: TextBlock, alignStyle: string): string {
  if (!block.plaintext || block.plaintext.trim() === '') {
    return '<p>&nbsp;</p>';
  }
  const content = applyFacets(block.plaintext, block.facets);
  return `<p${alignStyle}>${content}</p>`;
}

function renderHeaderBlock(block: HeaderBlock, alignStyle: string): string {
  const level = Math.min(Math.max(block.level || 1, 1), 6);
  const content = applyFacets(block.plaintext, block.facets);
  return `<h${level}${alignStyle}>${content}</h${level}>`;
}

function renderBlockquoteBlock(block: BlockquoteBlock, alignStyle: string): string {
  const content = applyFacets(block.plaintext, block.facets);
  return `<blockquote${alignStyle}>${content}</blockquote>`;
}

function renderImageBlock(block: ImageBlock, alignStyle: string): string {
  // Images are stored as blob references, we'd need the PDS URL to fetch them
  // For now, show a placeholder or skip
  const alt = block.alt ? escapeHtml(block.alt) : 'Image';
  const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : '';

  // If we had the blob URL, we'd render it here
  // For now, show that there's an image
  return `<figure${alignStyle}><div class="image-placeholder">[Image: ${alt}]</div>${caption}</figure>`;
}

function renderUnorderedListBlock(block: UnorderedListBlock): string {
  const items = block.children.map(item => renderListItem(item)).join('');
  return `<ul>${items}</ul>`;
}

function renderListItem(item: ListItem): string {
  // List item content is a block (text, header, or image)
  let content: string;
  if (item.content.$type === 'pub.leaflet.blocks.text') {
    const textBlock = item.content as TextBlock;
    content = applyFacets(textBlock.plaintext, textBlock.facets);
  } else if (item.content.$type === 'pub.leaflet.blocks.header') {
    const headerBlock = item.content as HeaderBlock;
    content = applyFacets(headerBlock.plaintext, headerBlock.facets);
  } else {
    // Image or other block type
    content = '[Content]';
  }

  let html = `<li>${content}`;

  if (item.children && item.children.length > 0) {
    const childItems = item.children.map(child => renderListItem(child)).join('');
    html += `<ul>${childItems}</ul>`;
  }

  html += '</li>';
  return html;
}

function renderCodeBlock(block: CodeBlock): string {
  const language = block.language ? ` class="language-${escapeHtml(block.language)}"` : '';
  return `<pre><code${language}>${escapeHtml(block.plaintext)}</code></pre>`;
}

function renderWebsiteBlock(block: { url: string; title?: string; description?: string }): string {
  if (!isValidUrl(block.url)) {
    return '<p><em>[Invalid URL]</em></p>';
  }

  const title = block.title ? escapeHtml(block.title) : escapeHtml(block.url);
  const description = block.description ? `<p>${escapeHtml(block.description)}</p>` : '';

  return `
    <div class="website-embed">
      <a href="${escapeHtml(block.url)}" target="_blank" rel="noopener noreferrer">${title}</a>
      ${description}
    </div>
  `;
}

// Validate DID format (did:plc:xxx or did:web:xxx)
function isValidDid(did: string): boolean {
  return /^did:(plc|web):[a-zA-Z0-9._-]+$/.test(did);
}

// Validate rkey format (alphanumeric with some special chars)
function isValidRkey(rkey: string): boolean {
  return /^[a-zA-Z0-9._~-]+$/.test(rkey) && rkey.length <= 512;
}

function renderBskyPostBlock(block: { uri: string }): string {
  // Parse AT-URI to get the post URL
  // Format: at://did:plc:xxx/app.bsky.feed.post/xxx
  const parts = block.uri.replace('at://', '').split('/');
  if (parts.length >= 3) {
    const did = parts[0];
    const rkey = parts[2];

    // Validate DID and rkey formats for security
    if (!isValidDid(did) || !isValidRkey(rkey)) {
      return '<p><em>[Invalid Bluesky post reference]</em></p>';
    }

    const bskyUrl = `https://bsky.app/profile/${encodeURIComponent(did)}/post/${encodeURIComponent(rkey)}`;
    return `
      <div class="bsky-embed">
        <a href="${escapeHtml(bskyUrl)}" target="_blank" rel="noopener noreferrer">
          View Bluesky post
        </a>
      </div>
    `;
  }
  return '<p><em>[Bluesky post]</em></p>';
}

// Render a page to HTML
function renderPage(page: LeafletPage): string {
  if (page.$type === 'pub.leaflet.pages.linearDocument') {
    const linearPage = page as LinearDocumentPage;
    return linearPage.blocks.map(block => renderBlock(block)).join('\n');
  }

  // Canvas pages not fully supported
  return '<p><em>[Canvas page - not fully supported]</em></p>';
}

// Render all pages to HTML
export function renderDocument(pages: LeafletPage[]): string {
  return pages.map((page, index) => {
    const pageHtml = renderPage(page);
    if (pages.length > 1) {
      return `<section class="page" data-page="${index + 1}">${pageHtml}</section>`;
    }
    return pageHtml;
  }).join('\n');
}

// Parse JSON content and render
export function renderDocumentContent(contentJson: string): string {
  try {
    const pages = JSON.parse(contentJson) as LeafletPage[];
    return renderDocument(pages);
  } catch (error) {
    console.error('Error parsing document content:', error);
    return '<p><em>Error rendering document content</em></p>';
  }
}
