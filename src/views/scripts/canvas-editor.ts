// Canvas editor JavaScript

export const canvasEditorScript = `
  (function() {
    // Canvas Editor JavaScript
    const app = document.getElementById('canvas-app');
    if (!app) return;

    const canvasId = app.dataset.canvasId;
    const csrfToken = app.dataset.csrfToken;
    let canvasTitle = app.dataset.canvasTitle;
    let blocks = JSON.parse(app.dataset.canvasBlocks || '[]');
    let canvasWidth = parseInt(app.dataset.canvasWidth) || 1200;
    let canvasHeight = parseInt(app.dataset.canvasHeight) || 800;

    const container = document.getElementById('canvas-container');
    const titleInput = document.getElementById('canvas-title');
    const addBlockBtn = document.getElementById('add-block-btn');
    const saveBtn = document.getElementById('save-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomLevelSpan = document.getElementById('zoom-level');
    const statusMessage = document.getElementById('status-message');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const duplicateBtn = document.getElementById('duplicate-btn');
    const snapGridBtn = document.getElementById('snap-grid-btn');

    // Zoom levels
    const zoomLevels = [25, 50, 75, 100, 125, 150, 200];
    let currentZoomIndex = 3; // Start at 100%

    // Grid configuration
    const GRID_SIZE = 20;
    let snapToGridEnabled = true;

    let selectedBlock = null;
    let selectedBlockId = null;
    let isDirty = false;

    // History stacks for undo/redo
    const undoStack = [];
    const redoStack = [];
    const MAX_HISTORY = 50;

    // Save current state to undo stack
    function saveState() {
      const state = JSON.stringify(blocks);
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
      const sourceBlock = blocks.find(function(b) { return b.id === selectedBlockId; });
      if (!sourceBlock) return;

      saveState();

      const newBlock = {
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

      const newEl = container.querySelector('[data-block-id="' + newBlock.id + '"]');
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
      const zoom = zoomLevels[currentZoomIndex];
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
      const el = document.createElement('div');
      el.className = 'canvas-block';
      el.dataset.blockId = block.id;
      el.style.left = block.x + 'px';
      el.style.top = block.y + 'px';
      el.style.width = block.width + 'px';
      el.style.height = block.height + 'px';

      const content = document.createElement('div');
      content.className = 'canvas-block-content';
      content.textContent = block.content;
      content.contentEditable = 'false';
      el.appendChild(content);

      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      el.appendChild(resizeHandle);

      // Selection
      el.addEventListener('mousedown', function(e) {
        if (e.target === resizeHandle) return;
        selectBlock(el, block);
      });

      // Double-click to edit
      el.addEventListener('dblclick', function(e) {
        startEditing(el, content, block);
      });

      // Drag handling
      let isDragging = false;
      let dragStateSaved = false;
      let startX, startY, origX, origY;

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
        const zoom = zoomLevels[currentZoomIndex] / 100;
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
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

      // Resize handling
      let isResizing = false;
      let resizeStateSaved = false;
      let resizeStartX, resizeStartY, origWidth, origHeight;

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
        const zoom = zoomLevels[currentZoomIndex] / 100;
        const dx = (e.clientX - resizeStartX) / zoom;
        const dy = (e.clientY - resizeStartY) / zoom;
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
      const originalContent = block.content;

      el.classList.add('editing');
      content.contentEditable = 'true';
      content.focus();

      const range = document.createRange();
      range.selectNodeContents(content);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      function stopEditing() {
        content.contentEditable = 'false';
        el.classList.remove('editing');
        const newContent = content.textContent;
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

    // Add new block
    addBlockBtn.addEventListener('click', function() {
      saveState();

      const baseX = snapToGrid(40 + Math.random() * 80);
      const baseY = snapToGrid(40 + Math.random() * 80);

      const newBlock = {
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

    // Save canvas
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

    // Zoom controls
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

    // Undo/Redo/Duplicate button handlers
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    duplicateBtn.addEventListener('click', duplicateBlock);

    // Snap to grid toggle
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

    // Title change
    titleInput.addEventListener('input', function() {
      markDirty();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      const isEditing = document.activeElement.tagName === 'INPUT' ||
                        document.activeElement.contentEditable === 'true';

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isEditing) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isEditing) {
        e.preventDefault();
        redo();
        return;
      }

      // Duplicate: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isEditing) {
        e.preventDefault();
        duplicateBlock();
        return;
      }

      // Delete selected block
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock && !isEditing) {
        const blockId = selectedBlock.dataset.blockId;
        const editableContent = selectedBlock.querySelector('.canvas-block-content');
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

    // Warn on unsaved changes
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

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      });
    }
  })();
`;
