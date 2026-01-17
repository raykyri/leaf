// Canvas Editor JavaScript
(function() {
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
  const GRID_SIZE = 20; // Grid cell size in pixels
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
    // Deep clone the blocks array
    const state = JSON.stringify(blocks);
    undoStack.push(state);
    // Limit history size
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }
    // Clear redo stack when new action is performed
    redoStack.length = 0;
    updateHistoryButtons();
  }

  // Update undo/redo button states
  function updateHistoryButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  // Update duplicate button state
  function updateDuplicateButton() {
    duplicateBtn.disabled = !selectedBlockId;
  }

  // Undo last action
  function undo() {
    if (undoStack.length === 0) return;
    // Save current state to redo stack
    redoStack.push(JSON.stringify(blocks));
    // Restore previous state
    blocks = JSON.parse(undoStack.pop());
    selectedBlock = null;
    selectedBlockId = null;
    renderBlocks();
    markDirty();
    updateHistoryButtons();
    updateDuplicateButton();
  }

  // Redo previously undone action
  function redo() {
    if (redoStack.length === 0) return;
    // Save current state to undo stack
    undoStack.push(JSON.stringify(blocks));
    // Restore next state
    blocks = JSON.parse(redoStack.pop());
    selectedBlock = null;
    selectedBlockId = null;
    renderBlocks();
    markDirty();
    updateHistoryButtons();
    updateDuplicateButton();
  }

  // Duplicate selected block
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
    updateCanvasHint();

    // Select the new block
    const newEl = container.querySelector('[data-block-id="' + newBlock.id + '"]');
    if (newEl) {
      selectBlock(newEl, newBlock);
    }
  }

  // Snap value to grid
  function snapToGrid(value) {
    if (!snapToGridEnabled) return Math.round(value);
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  // Generate unique ID
  function generateId() {
    return 'blk_' + Math.random().toString(36).substr(2, 9);
  }

  // Update status message
  function setStatus(msg) {
    statusMessage.textContent = msg;
  }

  // Mark as dirty (unsaved changes)
  function markDirty() {
    isDirty = true;
    setStatus('Unsaved changes');
  }

  // Apply zoom
  function applyZoom() {
    const zoom = zoomLevels[currentZoomIndex];
    container.style.transform = 'scale(' + (zoom / 100) + ')';
    zoomLevelSpan.textContent = zoom + '%';
  }

  // Create selection box element for drag-to-create
  const selectionBox = document.createElement('div');
  selectionBox.id = 'selection-box';
  container.appendChild(selectionBox);

  // Create canvas hint element
  const canvasHint = document.createElement('div');
  canvasHint.className = 'canvas-hint';
  canvasHint.innerHTML = '<div class="canvas-hint-icon">+</div>Click and drag to create a card';
  container.appendChild(canvasHint);

  // Update canvas hint visibility
  function updateCanvasHint() {
    canvasHint.style.display = blocks.length === 0 ? 'block' : 'none';
  }

  // Render all blocks
  function renderBlocks() {
    // Keep selection box and hint
    const children = Array.from(container.children);
    children.forEach(function(child) {
      if (child.id !== 'selection-box' && child.className !== 'canvas-hint') {
        child.remove();
      }
    });
    blocks.forEach(function(block) {
      renderBlock(block);
    });
    updateCanvasHint();
  }

  // Render a single block
  function renderBlock(block) {
    const el = document.createElement('div');
    el.className = 'canvas-block';
    el.dataset.blockId = block.id;
    el.style.left = block.x + 'px';
    el.style.top = block.y + 'px';
    el.style.width = block.width + 'px';
    el.style.height = block.height + 'px';

    // Header with close button and drag handle
    const header = document.createElement('div');
    header.className = 'canvas-block-header';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'canvas-block-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Delete block';
    header.appendChild(closeBtn);

    const dragHandle = document.createElement('div');
    dragHandle.className = 'canvas-block-drag';
    dragHandle.title = 'Drag to move';
    header.appendChild(dragHandle);

    el.appendChild(header);

    const content = document.createElement('div');
    content.className = 'canvas-block-content';
    content.textContent = block.content;
    content.contentEditable = 'false';
    el.appendChild(content);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    el.appendChild(resizeHandle);

    // Close button handler
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      saveState();
      blocks = blocks.filter(function(b) { return b.id !== block.id; });
      el.remove();
      if (selectedBlockId === block.id) {
        selectedBlock = null;
        selectedBlockId = null;
      }
      markDirty();
      updateDuplicateButton();
      updateCanvasHint();
    });

    // Selection on header click
    header.addEventListener('mousedown', function(e) {
      if (e.target === closeBtn) return;
      selectBlock(el, block);
    });

    // Click on content to edit
    content.addEventListener('click', function(e) {
      if (content.contentEditable !== 'true') {
        selectBlock(el, block);
        startEditing(el, content, block);
      }
    });

    // Drag handling - only from drag handle
    let isDragging = false;
    let dragStateSaved = false;
    let startX, startY, origX, origY;

    dragHandle.addEventListener('mousedown', function(e) {
      isDragging = true;
      dragStateSaved = false;
      startX = e.clientX;
      startY = e.clientY;
      origX = block.x;
      origY = block.y;
      el.style.zIndex = '1000';
      el.classList.add('active');
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      // Save state only on first move
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
        el.classList.remove('active');
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
      el.classList.add('active');
      e.stopPropagation();
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      // Save state only on first resize
      if (!resizeStateSaved) {
        saveState();
        resizeStateSaved = true;
      }
      const zoom = zoomLevels[currentZoomIndex] / 100;
      const dx = (e.clientX - resizeStartX) / zoom;
      const dy = (e.clientY - resizeStartY) / zoom;
      block.width = Math.max(GRID_SIZE * 4, snapToGrid(origWidth + dx));
      block.height = Math.max(GRID_SIZE * 4, snapToGrid(origHeight + dy));
      el.style.width = block.width + 'px';
      el.style.height = block.height + 'px';
      markDirty();
    });

    document.addEventListener('mouseup', function() {
      if (isResizing) {
        isResizing = false;
        resizeStateSaved = false;
        el.classList.remove('active');
      }
    });

    container.appendChild(el);
  }

  // Select a block
  function selectBlock(el, block) {
    // Deselect previous
    if (selectedBlock) {
      selectedBlock.classList.remove('selected');
    }
    selectedBlock = el;
    selectedBlockId = block.id;
    el.classList.add('selected');
    updateDuplicateButton();
  }

  // Start editing a block
  function startEditing(el, content, block) {
    // Save state before editing
    saveState();
    const originalContent = block.content;

    el.classList.add('editing');
    content.contentEditable = 'true';
    content.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(content);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function stopEditing() {
      content.contentEditable = 'false';
      el.classList.remove('editing');
      const newContent = content.textContent;
      // Only mark dirty if content actually changed
      if (newContent !== originalContent) {
        block.content = newContent;
        markDirty();
      } else {
        // Remove the saved state since nothing changed
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

  // Add new block via button
  addBlockBtn.addEventListener('click', function() {
    saveState();

    // Find a position that doesn't overlap with existing blocks
    const baseX = snapToGrid(40 + Math.random() * 80);
    const baseY = snapToGrid(40 + Math.random() * 80);

    const newBlock = {
      id: generateId(),
      type: 'text',
      content: '',
      x: baseX,
      y: baseY,
      width: GRID_SIZE * 10, // 200px when GRID_SIZE is 20
      height: GRID_SIZE * 5  // 100px when GRID_SIZE is 20
    };
    blocks.push(newBlock);
    renderBlock(newBlock);
    markDirty();
    updateCanvasHint();
  });

  // Click-and-drag on canvas to create blocks (Manifest-style)
  const viewport = document.querySelector('.canvas-viewport');
  let isCreating = false;
  let createStartX = 0;
  let createStartY = 0;
  const MIN_SIZE = 80; // Minimum size for block creation (like Manifest)

  container.addEventListener('mousedown', function(e) {
    // Only start creation if clicking directly on container (not on blocks)
    if (e.target !== container && e.target !== canvasHint &&
        e.target.id !== 'selection-box' && !e.target.classList.contains('canvas-hint-icon')) {
      return;
    }

    isCreating = true;
    const zoom = zoomLevels[currentZoomIndex] / 100;
    const containerRect = container.getBoundingClientRect();

    // Calculate position relative to container, accounting for zoom
    createStartX = (e.clientX - containerRect.left) / zoom;
    createStartY = (e.clientY - containerRect.top) / zoom;

    // Show selection box
    selectionBox.style.left = createStartX + 'px';
    selectionBox.style.top = createStartY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.classList.add('active');

    // Deselect any selected block
    if (selectedBlock) {
      selectedBlock.classList.remove('selected');
      selectedBlock = null;
      selectedBlockId = null;
      updateDuplicateButton();
    }

    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isCreating) return;

    const zoom = zoomLevels[currentZoomIndex] / 100;
    const containerRect = container.getBoundingClientRect();

    let currentX = (e.clientX - containerRect.left) / zoom;
    let currentY = (e.clientY - containerRect.top) / zoom;

    // Calculate dimensions
    let left = Math.min(createStartX, currentX);
    let top = Math.min(createStartY, currentY);
    let width = Math.abs(currentX - createStartX);
    let height = Math.abs(currentY - createStartY);

    // Snap to grid
    left = snapToGrid(left);
    top = snapToGrid(top);
    width = snapToGrid(width);
    height = snapToGrid(height);

    // Update selection box
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  });

  document.addEventListener('mouseup', function(e) {
    if (!isCreating) return;
    isCreating = false;

    // Get final dimensions from selection box
    const left = parseInt(selectionBox.style.left) || 0;
    const top = parseInt(selectionBox.style.top) || 0;
    const width = parseInt(selectionBox.style.width) || 0;
    const height = parseInt(selectionBox.style.height) || 0;

    // Hide selection box
    selectionBox.classList.remove('active');

    // Only create block if size meets minimum threshold
    if (width >= MIN_SIZE && height >= MIN_SIZE) {
      saveState();

      const newBlock = {
        id: generateId(),
        type: 'text',
        content: '',
        x: left,
        y: top,
        width: Math.max(width, GRID_SIZE * 4),
        height: Math.max(height, GRID_SIZE * 4)
      };
      blocks.push(newBlock);
      renderBlock(newBlock);
      markDirty();
      updateCanvasHint();

      // Select and start editing the new block
      const newEl = container.querySelector('[data-block-id="' + newBlock.id + '"]');
      if (newEl) {
        selectBlock(newEl, newBlock);
        const content = newEl.querySelector('.canvas-block-content');
        if (content) {
          startEditing(newEl, content, newBlock);
        }
      }
    }
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
  undoBtn.addEventListener('click', function() {
    undo();
  });

  redoBtn.addEventListener('click', function() {
    redo();
  });

  duplicateBtn.addEventListener('click', function() {
    duplicateBlock();
  });

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

    // Undo: Ctrl+Z (not when editing text)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isEditing) {
      e.preventDefault();
      undo();
      return;
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z (not when editing text)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isEditing) {
      e.preventDefault();
      redo();
      return;
    }

    // Duplicate: Ctrl+D (not when editing text)
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isEditing) {
      e.preventDefault();
      duplicateBlock();
      return;
    }

    // Delete selected block with Delete/Backspace key
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
      updateCanvasHint();
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
