# Canvas Pages Design Document

## Overview

This document describes the canvas functionality implemented in the Leaf ATProto appview, including both:
1. **ATProto Canvas Support**: Types and rendering for `pub.leaflet.pages.canvas` from the Leaflet lexicon
2. **Local Canvas Editor**: A standalone canvas creation and editing tool for local use

## Implementation Status

### Completed Features

| Feature | Status | Description |
|---------|--------|-------------|
| ATProto canvas types | Done | Full type definitions for `pub.leaflet.pages.canvas` |
| Local canvas database | Done | SQLite table for storing local canvases |
| Canvas CRUD routes | Done | Create, read, update, delete operations |
| Canvas API endpoints | Done | REST API for canvas data |
| Interactive editor | Done | Drag, resize, edit text blocks |
| Zoom controls | Done | Fixed zoom levels (25%-200%) |
| Full-width layout | Done | Dedicated canvas layout with toolbar |

## Architecture

### Local Canvas System

The local canvas system is separate from ATProto and provides a standalone canvas editing experience:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Local Canvas System                         │
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │   Routes      │───▶│   Database    │───▶│   SQLite      │   │
│  │ /canvases/*   │    │   Operations  │    │   canvases    │   │
│  └───────────────┘    └───────────────┘    └───────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  Canvas Editor (JS)                        │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │ │
│  │  │  Zoom   │  │  Drag   │  │ Resize  │  │  Edit   │      │ │
│  │  │ Control │  │ Blocks  │  │ Blocks  │  │  Text   │      │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
CREATE TABLE canvases (
  id TEXT PRIMARY KEY NOT NULL,       -- 16-char hex ID
  user_id INTEGER NOT NULL,           -- Foreign key to users
  title TEXT NOT NULL,                -- Canvas title (max 128 chars)
  blocks TEXT NOT NULL DEFAULT '[]',  -- JSON array of LocalCanvasBlock
  width INTEGER NOT NULL DEFAULT 1200,
  height INTEGER NOT NULL DEFAULT 800,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Type Definitions

#### ATProto Canvas Types (Leaflet-compatible)

```typescript
// src/types/leaflet.ts

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
  rotation?: number;  // Not currently rendered (per requirements)
}
```

#### Local Canvas Types

```typescript
// src/types/leaflet.ts

export interface LocalCanvas {
  id: string;
  title: string;
  blocks: LocalCanvasBlock[];
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}

export interface LocalCanvasBlock {
  id: string;
  type: 'text';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

## Routes

### Web Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/canvases` | List user's canvases |
| GET | `/canvases/new` | Create canvas form |
| POST | `/canvases/new` | Create new canvas |
| GET | `/canvases/:id` | Canvas editor page |
| POST | `/canvases/:id/delete` | Delete canvas |
| POST | `/canvases/:id/publish` | Publish canvas to ATProto |

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/canvases/:id` | Get canvas JSON |
| PUT | `/api/canvases/:id` | Update canvas (title, blocks) |

### API Request/Response

#### GET /api/canvases/:id

Response:
```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "title": "My Canvas",
  "blocks": [
    {
      "id": "blk_abc123",
      "type": "text",
      "content": "Hello World",
      "x": 100,
      "y": 50,
      "width": 200,
      "height": 100
    }
  ],
  "width": 1200,
  "height": 800,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

#### PUT /api/canvases/:id

Request:
```json
{
  "title": "Updated Title",
  "blocks": [/* block array */]
}
```

## Canvas Editor Features

### User Interface

The canvas editor provides a full-width interface with:

1. **Toolbar**
   - Back button (return to canvas list)
   - Title input (editable)
   - Add Text Block button
   - Zoom controls (-/+)
   - Save button
   - Publish to ATProto button
   - Delete button

2. **Viewport**
   - Scrollable canvas area
   - Dark background for contrast
   - Canvas surface with border and shadow

3. **Status Bar**
   - Status message (Ready/Unsaved changes/Saving/Saved)
   - Canvas dimensions

### Block Operations

| Operation | Interaction |
|-----------|-------------|
| Select | Click on block |
| Move | Drag block |
| Resize | Drag corner handle |
| Edit text | Double-click block |
| Delete | Select + Delete/Backspace key |

### Zoom Levels

Fixed zoom levels for consistent rendering:

| Level | Scale |
|-------|-------|
| 25% | 0.25x |
| 50% | 0.5x |
| 75% | 0.75x |
| 100% | 1.0x (default) |
| 125% | 1.25x |
| 150% | 1.5x |
| 200% | 2.0x |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete/Backspace | Delete selected block |
| Escape | Stop editing text |

## File Structure

```
src/
├── database/
│   ├── schema.ts      # Added canvases table
│   └── index.ts       # Added canvas CRUD operations
├── routes/
│   └── canvases.ts    # NEW: Canvas routes and API
├── types/
│   └── leaflet.ts     # Added canvas type definitions
└── views/
    ├── layout.ts      # Added canvasLayout() function
    └── pages.ts       # Added canvas page templates
```

## Navigation

The "Canvases" link appears in the main navigation for logged-in users:

```
All Posts | My Posts | Canvases | New Post | Logout
```

## Comparison with Leaflet

| Feature | Leaflet | Leaf (Implemented) |
|---------|---------|-------------------|
| Real-time collaboration | Yes (Replicache) | No |
| ATProto sync | Yes | No (local only) |
| Drag blocks | Yes | Yes |
| Resize blocks | Yes | Yes |
| Rotate blocks | Yes | No |
| Text blocks | Yes | Yes |
| Image blocks | Yes | No |
| Other block types | Yes | No |
| Zoom | Yes | Yes (fixed levels) |
| Background patterns | Yes | No |

## Security

1. **Authentication**: All canvas routes require login
2. **Authorization**: Users can only access their own canvases
3. **CSRF**: All mutations protected by CSRF tokens
4. **Input Validation**: Title length, canvas dimensions, block structure
5. **XSS Prevention**: All output escaped with `escapeHtml()`

## ATProto Integration

### Publishing to Leaflet Format

Local canvases can be published to ATProto as `pub.leaflet.document` records with `pub.leaflet.pages.canvas` page type. This makes them compatible with the official Leaflet app.

**Conversion Process:**

```
Local Canvas → ATProto Document
─────────────────────────────────
LocalCanvasBlock {          CanvasBlockWithPosition {
  id: "blk_abc123"            block: {
  type: "text"         →        $type: "pub.leaflet.blocks.text"
  content: "Hello"              plaintext: "Hello"
  x: 100                        facets: []
  y: 50                       }
  width: 200                  x: 100
  height: 100                 y: 50
}                             width: 200
                              height: 100
                            }
```

**Publishing Flow:**

1. User clicks "Publish to ATProto" button
2. System gets authenticated ATProto agent (app password or OAuth)
3. Local blocks are converted to Leaflet format
4. Document is created on user's PDS via `com.atproto.repo.createRecord`
5. Document is indexed locally for display
6. User is redirected to the published post

**Implementation:**

```typescript
// src/services/posts.ts
export async function publishCanvas(
  agent: AtpAgent,
  user: db.User,
  input: { canvasId: string }
): Promise<PublishCanvasResult>
```

### Compatibility

Published canvases are fully compatible with:
- Leaflet.pub (official Leaflet app)
- Any ATProto appview that supports `pub.leaflet.pages.canvas`
- The local Leaf appview post viewer

## Future Enhancements

1. **Additional Block Types**: Images, headers, code blocks
2. **Import from ATProto**: Load existing Leaflet canvases for editing
3. **Collaboration**: Real-time editing with multiple users
4. **Export**: PNG, PDF, or SVG export
5. **Templates**: Pre-made canvas layouts
6. **Grid/Snap**: Align blocks to grid
7. **Undo/Redo**: History management
8. **Copy/Paste**: Duplicate blocks
9. **Sync Changes**: Update published canvas instead of creating new

## Usage Example

1. Navigate to `/canvases`
2. Click "New Canvas"
3. Enter a title and click "Create Canvas"
4. In the editor:
   - Click "+ Add Text Block" to add blocks
   - Drag blocks to position them
   - Double-click to edit text
   - Drag corner handle to resize
   - Use +/- buttons to zoom
   - Click "Save" to persist changes
5. Click "Publish to ATProto" to publish as a Leaflet document
6. Navigate away or close - unsaved changes will prompt

## References

- [Leaflet Repository](https://github.com/hyperlink-academy/leaflet)
- [Canvas Lexicon](https://github.com/hyperlink-academy/leaflet/blob/main/lexicons/pub/leaflet/pages/canvas.json)
- [ATProto Lexicon Docs](https://atproto.com/specs/lexicon)
