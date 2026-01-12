# Canvas Pages Design Document

## Overview

This document outlines the design for implementing canvas page support in the Leaf ATProto appview, based on analysis of the [hyperlink-academy/leaflet](https://github.com/hyperlink-academy/leaflet) project's canvas implementation.

**Key Finding: Leaflet's canvases ARE on ATProto.** Canvas pages are defined in the `pub.leaflet.pages.canvas` lexicon and are a first-class page type alongside linear documents.

## Current State

### Leaf (This Repository)

The local repository is an ATProto appview that:
- Indexes `pub.leaflet.document` and `pub.leaflet.publication` records from user PDS repositories
- Subscribes to Jetstream for real-time updates
- Renders documents server-side as HTML
- Supports 14 block types and 2 page types (linear document + canvas stub)

**Current Canvas Support:**
```typescript
// src/types/leaflet.ts:83-87
export interface CanvasPage {
  $type: 'pub.leaflet.pages.canvas';
  id?: string;
  // Canvas-specific properties (not fully implementing for MVP)
}
```

```typescript
// src/services/renderer.ts:372-379
// Canvas pages currently render as:
'<p><em>[Canvas page - not fully supported]</em></p>'
```

### Leaflet (hyperlink-academy/leaflet)

Leaflet is a full-featured publishing platform with:
- Real-time collaboration via Replicache
- Supabase backend for data persistence
- ATProto appview for network indexing
- Interactive canvas editor with drag, resize, and rotate

## Lexicon Analysis

### Canvas Page Schema (`pub.leaflet.pages.canvas`)

```typescript
interface CanvasPage {
  $type: 'pub.leaflet.pages.canvas';
  id?: string;
  blocks: CanvasBlock[];
}

interface CanvasBlock {
  block: Block;  // Same block union as linear documents
  x: number;     // X coordinate (integer)
  y: number;     // Y coordinate (integer)
  width: number; // Block width (integer)
  height?: number;    // Optional height (integer)
  rotation?: number;  // Rotation in degrees (integer)
}
```

### Linear Document Page Schema (`pub.leaflet.pages.linearDocument`)

```typescript
interface LinearDocumentPage {
  $type: 'pub.leaflet.pages.linearDocument';
  id?: string;
  blocks: BlockWithAlignment[];
}

interface BlockWithAlignment {
  block: Block;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}
```

### Key Differences

| Aspect | Linear Document | Canvas |
|--------|-----------------|--------|
| Block positioning | Sequential (array order) | Absolute (x, y coordinates) |
| Sizing | Content-driven | Explicit width/height |
| Rotation | Not supported | Supported (degrees) |
| Alignment | Text alignment per block | N/A (use positioning) |
| Rendering | Vertical flow | 2D spatial layout |

### Shared Block Types

Both page types support the same 14 block types:
1. `pub.leaflet.blocks.text` - Plain text with facets
2. `pub.leaflet.blocks.header` - Headers (h1-h6)
3. `pub.leaflet.blocks.blockquote` - Quoted text
4. `pub.leaflet.blocks.image` - Images with alt text
5. `pub.leaflet.blocks.code` - Code with syntax highlighting
6. `pub.leaflet.blocks.math` - LaTeX/TeX expressions
7. `pub.leaflet.blocks.horizontalRule` - Visual dividers
8. `pub.leaflet.blocks.unorderedList` - Bullet lists
9. `pub.leaflet.blocks.website` - Link embeds
10. `pub.leaflet.blocks.bskyPost` - Bluesky post embeds
11. `pub.leaflet.blocks.button` - Clickable buttons
12. `pub.leaflet.blocks.iframe` - Embedded content
13. `pub.leaflet.blocks.poll` - Poll references
14. `pub.leaflet.blocks.page` - Page references

## Implementation Plan

### Phase 1: Type Definitions

Update `src/types/leaflet.ts` with complete canvas types:

```typescript
export interface CanvasPage {
  $type: 'pub.leaflet.pages.canvas';
  id?: string;
  blocks: CanvasBlockWithPosition[];
}

export interface CanvasBlockWithPosition {
  $type?: 'pub.leaflet.pages.canvas#block';
  block: Block;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
}
```

### Phase 2: Renderer Implementation

Update `src/services/renderer.ts` to render canvas pages:

```typescript
function renderCanvasPage(page: CanvasPage): string {
  // Sort blocks by y-position, then x-position for consistent rendering
  const sortedBlocks = [...page.blocks].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  // Calculate canvas dimensions
  const maxX = Math.max(...sortedBlocks.map(b => b.x + b.width));
  const maxY = Math.max(...sortedBlocks.map(b => b.y + (b.height || 200)));

  const blocksHtml = sortedBlocks.map(block => {
    const style = buildCanvasBlockStyle(block);
    const content = renderBlock({ block: block.block });
    return `<div class="canvas-block" style="${style}">${content}</div>`;
  }).join('\n');

  return `
    <div class="canvas-page" style="position: relative; width: ${maxX}px; min-height: ${maxY}px;">
      ${blocksHtml}
    </div>
  `;
}

function buildCanvasBlockStyle(block: CanvasBlockWithPosition): string {
  const styles = [
    'position: absolute',
    `left: ${block.x}px`,
    `top: ${block.y}px`,
    `width: ${block.width}px`,
  ];

  if (block.height) {
    styles.push(`height: ${block.height}px`);
  }

  if (block.rotation) {
    styles.push(`transform: rotate(${block.rotation}deg)`);
  }

  return styles.join('; ');
}
```

### Phase 3: CSS Styling

Add canvas-specific styles to the rendered output:

```css
.canvas-page {
  position: relative;
  overflow: visible;
}

.canvas-block {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
}

/* Ensure block content respects container width */
.canvas-block > * {
  max-width: 100%;
}
```

### Phase 4: Database Considerations

No database schema changes required. The current schema stores pages as JSON in the `content` field, which already supports arbitrary page structures.

### Phase 5: Testing

Add test cases for:
1. Canvas page type detection
2. Block positioning and sizing
3. Rotation transformations
4. Mixed document rendering (linear + canvas pages)
5. Edge cases (empty canvas, overlapping blocks, negative coordinates)

## Rendering Approaches

### Option A: Static HTML (Recommended for MVP)

Render canvas as static positioned HTML:
- Pros: Simple, no JavaScript required, SEO-friendly
- Cons: No interactivity, fixed viewport

### Option B: SVG Rendering

Render canvas as SVG:
- Pros: Better scaling, precise positioning
- Cons: More complex, text handling challenges

### Option C: Canvas Element

Render to HTML5 `<canvas>`:
- Pros: Full rendering control
- Cons: Not SEO-friendly, requires JavaScript, accessibility issues

**Recommendation:** Start with Option A for the appview (read-only display). Interactive editing would require a separate frontend implementation.

## Security Considerations

1. **XSS Prevention**: Continue using `escapeHtml()` for all text content
2. **URL Validation**: Validate URLs in positioned blocks
3. **Size Limits**: Consider maximum canvas dimensions to prevent DoS
4. **Rotation Limits**: Sanitize rotation values (0-360 degrees)

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ATProto Network                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              pub.leaflet.document Record                 │   │
│  │  {                                                       │   │
│  │    "pages": [                                            │   │
│  │      { "$type": "pub.leaflet.pages.linearDocument", ...},│   │
│  │      { "$type": "pub.leaflet.pages.canvas",              │   │
│  │        "blocks": [                                       │   │
│  │          { "block": {...}, "x": 100, "y": 50, "width": 200}│  │
│  │        ]                                                 │   │
│  │      }                                                   │   │
│  │    ]                                                     │   │
│  │  }                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Leaf Appview                               │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │   Jetstream   │───▶│    Indexer    │───▶│   Database    │   │
│  │   Listener    │    │               │    │   (SQLite)    │   │
│  └───────────────┘    └───────────────┘    └───────────────┘   │
│                                                    │            │
│                                                    ▼            │
│                              ┌───────────────────────────────┐  │
│                              │         Renderer              │  │
│                              │  ┌─────────────────────────┐  │  │
│                              │  │  renderPage()           │  │  │
│                              │  │    ├─ LinearDocument    │  │  │
│                              │  │    └─ Canvas ◀── NEW    │  │  │
│                              │  └─────────────────────────┘  │  │
│                              └───────────────────────────────┘  │
│                                                    │            │
│                                                    ▼            │
│                                              HTML Output        │
└─────────────────────────────────────────────────────────────────┘
```

## Compatibility Notes

### With Leaflet

This implementation aims to be compatible with Leaflet's ATProto records:
- Same lexicon schemas (`pub.leaflet.pages.canvas`)
- Same block types
- Same positioning semantics

### Limitations vs Leaflet

| Feature | Leaflet | Leaf Appview |
|---------|---------|--------------|
| Real-time editing | ✓ (Replicache) | ✗ (read-only) |
| Drag & resize | ✓ | ✗ |
| Rotation editing | ✓ | ✗ (display only) |
| Background patterns | ✓ (dot/grid/plain) | ✗ (future) |
| Interactive blocks | ✓ | ✗ |

## File Changes Required

1. **`src/types/leaflet.ts`**
   - Add `CanvasBlockWithPosition` interface
   - Update `CanvasPage` interface with `blocks` property

2. **`src/services/renderer.ts`**
   - Add `renderCanvasPage()` function
   - Add `buildCanvasBlockStyle()` helper
   - Update `renderPage()` to dispatch to canvas renderer

3. **`src/services/renderer.test.ts`**
   - Add canvas rendering tests
   - Add positioning tests
   - Add rotation tests

4. **`src/views/layout.ts`** (optional)
   - Add canvas-specific CSS styles

## Estimated Effort

| Phase | Complexity | Estimate |
|-------|------------|----------|
| Type definitions | Low | Small |
| Basic renderer | Medium | Medium |
| CSS styling | Low | Small |
| Testing | Medium | Medium |
| **Total** | | **Medium** |

## Future Enhancements

1. **Background Patterns**: Support `canvas/background-pattern` (dot, grid, plain)
2. **Zoom/Pan**: Allow viewport navigation for large canvases
3. **Responsive Scaling**: Scale canvas to fit viewport
4. **Block Shadows**: Visual depth for overlapping blocks
5. **Export Options**: PNG/PDF export of canvas pages

## References

- [Leaflet Repository](https://github.com/hyperlink-academy/leaflet)
- [Canvas Lexicon](https://github.com/hyperlink-academy/leaflet/blob/main/lexicons/pub/leaflet/pages/canvas.json)
- [ATProto Lexicon Docs](https://atproto.com/specs/lexicon)

## Appendix: Sample Canvas Document

```json
{
  "$type": "pub.leaflet.document",
  "title": "My Canvas Document",
  "author": "did:plc:example",
  "pages": [
    {
      "$type": "pub.leaflet.pages.canvas",
      "id": "canvas-1",
      "blocks": [
        {
          "block": {
            "$type": "pub.leaflet.blocks.header",
            "plaintext": "Welcome",
            "level": 1
          },
          "x": 100,
          "y": 50,
          "width": 300
        },
        {
          "block": {
            "$type": "pub.leaflet.blocks.text",
            "plaintext": "This is positioned text on a canvas."
          },
          "x": 100,
          "y": 150,
          "width": 400
        },
        {
          "block": {
            "$type": "pub.leaflet.blocks.image",
            "image": {
              "$type": "blob",
              "ref": { "$link": "bafkrei..." },
              "mimeType": "image/png",
              "size": 12345
            },
            "alt": "Example image"
          },
          "x": 550,
          "y": 50,
          "width": 200,
          "height": 200,
          "rotation": 5
        }
      ]
    }
  ]
}
```
