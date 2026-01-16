import React from 'react';
// Canvas editor page component using Radix UI
import { Box } from '@radix-ui/themes';
import { CanvasLayout } from '../components/CanvasLayout.tsx';
import { escapeHtml } from '../components/index.ts';
import type { Canvas } from '../../database/index.ts';

interface CanvasEditorPageProps {
  canvas: Canvas;
  user: { handle: string; csrfToken?: string };
}

export function CanvasEditorPage({ canvas, user }: CanvasEditorPageProps): React.ReactElement {
  const blocks = JSON.parse(canvas.blocks);

  return (
    <CanvasLayout title={canvas.title} user={user}>
      <Box
        id="canvas-app"
        data-canvas-id={escapeHtml(canvas.id)}
        data-canvas-title={escapeHtml(canvas.title)}
        data-canvas-width={canvas.width.toString()}
        data-canvas-height={canvas.height.toString()}
        data-canvas-blocks={escapeHtml(JSON.stringify(blocks))}
        data-csrf-token={escapeHtml(user.csrfToken || '')}
      >
        <div className="canvas-toolbar">
          <div className="toolbar-left">
            <a href="/canvases" className="toolbar-btn">← Back</a>
            <input
              type="text"
              id="canvas-title"
              defaultValue={canvas.title}
              className="canvas-title-input"
            />
          </div>
          <div className="toolbar-center">
            <button id="undo-btn" className="toolbar-btn" title="Undo (Ctrl+Z)" disabled>Undo</button>
            <button id="redo-btn" className="toolbar-btn" title="Redo (Ctrl+Y)" disabled>Redo</button>
            <span className="toolbar-separator"></span>
            <button id="add-block-btn" className="toolbar-btn">+ Add Text Block</button>
            <button id="duplicate-btn" className="toolbar-btn" title="Duplicate (Ctrl+D)" disabled>Duplicate</button>
            <button id="snap-grid-btn" className="toolbar-btn active" title="Toggle snap to grid">⊞ Snap to Grid</button>
          </div>
          <div className="toolbar-right">
            <div className="zoom-controls">
              <button id="zoom-out-btn" className="toolbar-btn">-</button>
              <span id="zoom-level">100%</span>
              <button id="zoom-in-btn" className="toolbar-btn">+</button>
            </div>
            <button id="save-btn" className="toolbar-btn primary">Save</button>
            <form
              action={`/canvases/${escapeHtml(canvas.id)}/publish`}
              method="POST"
              className="inline-form"
            >
              <input type="hidden" name="_csrf" value={escapeHtml(user.csrfToken || '')} />
              <button type="submit" className="toolbar-btn" style={{ background: '#059669', borderColor: '#059669' }}>
                Publish to ATProto
              </button>
            </form>
            <form
              action={`/canvases/${escapeHtml(canvas.id)}/delete`}
              method="POST"
              className="inline-form"
            >
              <input type="hidden" name="_csrf" value={escapeHtml(user.csrfToken || '')} />
              <button type="submit" className="toolbar-btn danger">Delete</button>
            </form>
          </div>
        </div>
        <div className="canvas-viewport">
          <div
            id="canvas-container"
            className="canvas-container"
            style={{ width: `${canvas.width}px`, height: `${canvas.height}px` }}
          >
            {/* Blocks will be rendered here by JavaScript */}
          </div>
        </div>
        <div id="status-bar" className="status-bar">
          <span id="status-message">Ready</span>
          <span id="canvas-dimensions">{canvas.width} x {canvas.height}</span>
        </div>
      </Box>

      {/* Canvas editor JavaScript */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          // Confirmation dialogs
          document.querySelectorAll('form[action*="/delete"]').forEach(function(form) {
            form.addEventListener('submit', function(e) {
              if (!confirm('Are you sure you want to delete this canvas?')) {
                e.preventDefault();
              }
            });
          });
          document.querySelectorAll('form[action*="/publish"]').forEach(function(form) {
            form.addEventListener('submit', function(e) {
              if (!confirm('Publish this canvas to ATProto? This will create a Leaflet document on your PDS.')) {
                e.preventDefault();
              }
            });
          });

          // Canvas Editor JavaScript
          var app = document.getElementById('canvas-app');
          if (!app) return;

          var canvasId = app.dataset.canvasId;
          var csrfToken = app.dataset.csrfToken;
          var canvasTitle = app.dataset.canvasTitle;
          var blocks = JSON.parse(app.dataset.canvasBlocks || '[]');
          var canvasWidth = parseInt(app.dataset.canvasWidth) || 1200;
          var canvasHeight = parseInt(app.dataset.canvasHeight) || 800;

          var container = document.getElementById('canvas-container');
          var titleInput = document.getElementById('canvas-title');
          var addBlockBtn = document.getElementById('add-block-btn');
          var saveBtn = document.getElementById('save-btn');
          var zoomInBtn = document.getElementById('zoom-in-btn');
          var zoomOutBtn = document.getElementById('zoom-out-btn');
          var zoomLevelSpan = document.getElementById('zoom-level');
          var statusMessage = document.getElementById('status-message');
          var undoBtn = document.getElementById('undo-btn');
          var redoBtn = document.getElementById('redo-btn');
          var duplicateBtn = document.getElementById('duplicate-btn');
          var snapGridBtn = document.getElementById('snap-grid-btn');

          // Zoom levels
          var zoomLevels = [25, 50, 75, 100, 125, 150, 200];
          var currentZoomIndex = 3; // Start at 100%

          // Grid configuration
          var GRID_SIZE = 20;
          var snapToGridEnabled = true;

          var selectedBlock = null;
          var selectedBlockId = null;
          var isDirty = false;

          // History stacks for undo/redo
          var undoStack = [];
          var redoStack = [];
          var MAX_HISTORY = 50;

          function saveState() {
            var state = JSON.stringify(blocks);
            undoStack.push(state);
            if (undoStack.length > MAX_HISTORY) {
              undoStack.shift();
            }
            redoStack.length = 0;
            updateHistoryButtons();
          }

          function updateHistoryButtons() {
            undoBtn.disabled = undoStack.length === 0;
            redoBtn.disabled = redoStack.length === 0;
          }

          function updateDuplicateButton() {
            duplicateBtn.disabled = !selectedBlockId;
          }

          function undo() {
            if (undoStack.length === 0) return;
            redoStack.push(JSON.stringify(blocks));
            blocks = JSON.parse(undoStack.pop());
            selectedBlock = null;
            selectedBlockId = null;
            renderBlocks();
            markDirty();
            updateHistoryButtons();
            updateDuplicateButton();
          }

          function redo() {
            if (redoStack.length === 0) return;
            undoStack.push(JSON.stringify(blocks));
            blocks = JSON.parse(redoStack.pop());
            selectedBlock = null;
            selectedBlockId = null;
            renderBlocks();
            markDirty();
            updateHistoryButtons();
            updateDuplicateButton();
          }

          function duplicateBlock() {
            if (!selectedBlockId) return;
            var sourceBlock = blocks.find(function(b) { return b.id === selectedBlockId; });
            if (!sourceBlock) return;

            saveState();

            var newBlock = {
              id: generateId(),
              type: sourceBlock.type,
              content: sourceBlock.content,
              x: sourceBlock.x + 20,
              y: sourceBlock.y + 20,
              width: sourceBlock.width,
              height: sourceBlock.height
            };
            blocks.push(newBlock);
            renderBlock(newBlock);
            markDirty();

            var newEl = container.querySelector('[data-block-id="' + newBlock.id + '"]');
            if (newEl) {
              selectBlock(newEl, newBlock);
            }
          }

          function snapToGrid(value) {
            if (!snapToGridEnabled) return Math.round(value);
            return Math.round(value / GRID_SIZE) * GRID_SIZE;
          }

          function generateId() {
            return 'blk_' + Math.random().toString(36).substr(2, 9);
          }

          function setStatus(msg) {
            statusMessage.textContent = msg;
          }

          function markDirty() {
            isDirty = true;
            setStatus('Unsaved changes');
          }

          function applyZoom() {
            var zoom = zoomLevels[currentZoomIndex];
            container.style.transform = 'scale(' + (zoom / 100) + ')';
            zoomLevelSpan.textContent = zoom + '%';
          }

          function renderBlocks() {
            container.innerHTML = '';
            blocks.forEach(function(block) {
              renderBlock(block);
            });
          }

          function renderBlock(block) {
            var el = document.createElement('div');
            el.className = 'canvas-block';
            el.dataset.blockId = block.id;
            el.style.left = block.x + 'px';
            el.style.top = block.y + 'px';
            el.style.width = block.width + 'px';
            el.style.height = block.height + 'px';

            var content = document.createElement('div');
            content.className = 'canvas-block-content';
            content.textContent = block.content;
            content.contentEditable = 'false';
            el.appendChild(content);

            var resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';
            el.appendChild(resizeHandle);

            el.addEventListener('mousedown', function(e) {
              if (e.target === resizeHandle) return;
              selectBlock(el, block);
            });

            el.addEventListener('dblclick', function(e) {
              startEditing(el, content, block);
            });

            var isDragging = false;
            var dragStateSaved = false;
            var startX, startY, origX, origY;

            el.addEventListener('mousedown', function(e) {
              if (e.target === resizeHandle || content.contentEditable === 'true') return;
              isDragging = true;
              dragStateSaved = false;
              startX = e.clientX;
              startY = e.clientY;
              origX = block.x;
              origY = block.y;
              el.style.zIndex = '1000';
              e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
              if (!isDragging) return;
              if (!dragStateSaved) {
                saveState();
                dragStateSaved = true;
              }
              var zoom = zoomLevels[currentZoomIndex] / 100;
              var dx = (e.clientX - startX) / zoom;
              var dy = (e.clientY - startY) / zoom;
              block.x = Math.max(0, snapToGrid(origX + dx));
              block.y = Math.max(0, snapToGrid(origY + dy));
              el.style.left = block.x + 'px';
              el.style.top = block.y + 'px';
              markDirty();
            });

            document.addEventListener('mouseup', function() {
              if (isDragging) {
                isDragging = false;
                dragStateSaved = false;
                el.style.zIndex = '';
              }
            });

            var isResizing = false;
            var resizeStateSaved = false;
            var resizeStartX, resizeStartY, origWidth, origHeight;

            resizeHandle.addEventListener('mousedown', function(e) {
              isResizing = true;
              resizeStateSaved = false;
              resizeStartX = e.clientX;
              resizeStartY = e.clientY;
              origWidth = block.width;
              origHeight = block.height;
              e.stopPropagation();
              e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
              if (!isResizing) return;
              if (!resizeStateSaved) {
                saveState();
                resizeStateSaved = true;
              }
              var zoom = zoomLevels[currentZoomIndex] / 100;
              var dx = (e.clientX - resizeStartX) / zoom;
              var dy = (e.clientY - resizeStartY) / zoom;
              block.width = Math.max(GRID_SIZE * 2, snapToGrid(origWidth + dx));
              block.height = Math.max(GRID_SIZE * 2, snapToGrid(origHeight + dy));
              el.style.width = block.width + 'px';
              el.style.height = block.height + 'px';
              markDirty();
            });

            document.addEventListener('mouseup', function() {
              if (isResizing) {
                isResizing = false;
                resizeStateSaved = false;
              }
            });

            container.appendChild(el);
          }

          function selectBlock(el, block) {
            if (selectedBlock) {
              selectedBlock.classList.remove('selected');
            }
            selectedBlock = el;
            selectedBlockId = block.id;
            el.classList.add('selected');
            updateDuplicateButton();
          }

          function startEditing(el, content, block) {
            saveState();
            var originalContent = block.content;

            el.classList.add('editing');
            content.contentEditable = 'true';
            content.focus();

            var range = document.createRange();
            range.selectNodeContents(content);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            function stopEditing() {
              content.contentEditable = 'false';
              el.classList.remove('editing');
              var newContent = content.textContent;
              if (newContent !== originalContent) {
                block.content = newContent;
                markDirty();
              } else {
                undoStack.pop();
                updateHistoryButtons();
              }
              content.removeEventListener('blur', stopEditing);
              content.removeEventListener('keydown', handleKey);
            }

            function handleKey(e) {
              if (e.key === 'Escape') {
                stopEditing();
              }
            }

            content.addEventListener('blur', stopEditing);
            content.addEventListener('keydown', handleKey);
          }

          addBlockBtn.addEventListener('click', function() {
            saveState();

            var baseX = snapToGrid(40 + Math.random() * 80);
            var baseY = snapToGrid(40 + Math.random() * 80);

            var newBlock = {
              id: generateId(),
              type: 'text',
              content: 'New text block',
              x: baseX,
              y: baseY,
              width: GRID_SIZE * 10,
              height: GRID_SIZE * 5
            };
            blocks.push(newBlock);
            renderBlock(newBlock);
            markDirty();
          });

          saveBtn.addEventListener('click', function() {
            setStatus('Saving...');
            saveBtn.disabled = true;

            fetch('/api/canvases/' + canvasId, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                title: titleInput.value,
                blocks: blocks
              })
            })
            .then(function(res) {
              if (!res.ok) throw new Error('Save failed');
              return res.json();
            })
            .then(function(data) {
              isDirty = false;
              canvasTitle = data.title;
              if (data.synced) {
                setStatus('Saved & synced');
              } else if (data.syncError) {
                setStatus('Saved locally (sync error: ' + data.syncError + ')');
              } else {
                setStatus('Saved');
              }
            })
            .catch(function(err) {
              setStatus('Error saving: ' + err.message);
            })
            .finally(function() {
              saveBtn.disabled = false;
            });
          });

          zoomInBtn.addEventListener('click', function() {
            if (currentZoomIndex < zoomLevels.length - 1) {
              currentZoomIndex++;
              applyZoom();
            }
          });

          zoomOutBtn.addEventListener('click', function() {
            if (currentZoomIndex > 0) {
              currentZoomIndex--;
              applyZoom();
            }
          });

          undoBtn.addEventListener('click', function() {
            undo();
          });

          redoBtn.addEventListener('click', function() {
            redo();
          });

          duplicateBtn.addEventListener('click', function() {
            duplicateBlock();
          });

          function updateSnapGridState() {
            if (snapToGridEnabled) {
              snapGridBtn.classList.add('active');
              container.classList.add('show-grid');
            } else {
              snapGridBtn.classList.remove('active');
              container.classList.remove('show-grid');
            }
          }

          snapGridBtn.addEventListener('click', function() {
            snapToGridEnabled = !snapToGridEnabled;
            updateSnapGridState();
          });

          titleInput.addEventListener('input', function() {
            markDirty();
          });

          document.addEventListener('keydown', function(e) {
            var isEditing = document.activeElement.tagName === 'INPUT' ||
                            document.activeElement.contentEditable === 'true';

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isEditing) {
              e.preventDefault();
              undo();
              return;
            }

            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isEditing) {
              e.preventDefault();
              redo();
              return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isEditing) {
              e.preventDefault();
              duplicateBlock();
              return;
            }

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock && !isEditing) {
              var blockId = selectedBlock.dataset.blockId;
              var editableContent = selectedBlock.querySelector('.canvas-block-content');
              if (editableContent && editableContent.contentEditable === 'true') return;

              saveState();
              blocks = blocks.filter(function(b) { return b.id !== blockId; });
              selectedBlock.remove();
              selectedBlock = null;
              selectedBlockId = null;
              markDirty();
              updateDuplicateButton();
            }
          });

          window.addEventListener('beforeunload', function(e) {
            if (isDirty) {
              e.preventDefault();
              e.returnValue = '';
            }
          });

          // Initial render
          renderBlocks();
          applyZoom();
          updateSnapGridState();
          setStatus('Ready');
        })();
      ` }} />
    </CanvasLayout>
  );
}
