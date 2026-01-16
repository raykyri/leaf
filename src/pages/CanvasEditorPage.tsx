import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/Button';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dialog from '@radix-ui/react-dialog';
import { generateId } from '@/lib/utils';
import styles from './CanvasEditorPage.module.css';

interface Block {
  id: string;
  type: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Canvas {
  id: string;
  title: string;
  width: number;
  height: number;
  blocks: string;
}

const GRID_SIZE = 20;
const MIN_BLOCK_SIZE = 80;
const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200];
const MAX_HISTORY = 50;

export function CanvasEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { user, csrfToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Canvas state
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState('Ready');

  // Editor state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(3); // 100%
  const [snapToGrid, setSnapToGrid] = useState(true);

  // History for undo/redo
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Refs for drag and selection
  const containerRef = useRef<HTMLDivElement>(null);
  const isCreating = useRef(false);
  const createStart = useRef({ x: 0, y: 0 });
  const selectionBoxRef = useRef<HTMLDivElement>(null);

  const zoom = ZOOM_LEVELS[zoomIndex];

  // Snap value to grid
  const snap = useCallback((value: number) => {
    if (!snapToGrid) return Math.round(value);
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }, [snapToGrid]);

  // Save state to undo stack
  const saveState = useCallback(() => {
    setUndoStack(prev => {
      const newStack = [...prev, JSON.stringify(blocks)];
      if (newStack.length > MAX_HISTORY) newStack.shift();
      return newStack;
    });
    setRedoStack([]);
  }, [blocks]);

  // Undo
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, JSON.stringify(blocks)]);
    setUndoStack(prev => prev.slice(0, -1));
    setBlocks(JSON.parse(lastState));
    setSelectedBlockId(null);
    setIsDirty(true);
  }, [undoStack, blocks]);

  // Redo
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, JSON.stringify(blocks)]);
    setRedoStack(prev => prev.slice(0, -1));
    setBlocks(JSON.parse(nextState));
    setSelectedBlockId(null);
    setIsDirty(true);
  }, [redoStack, blocks]);

  // Fetch canvas data
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchCanvas = async () => {
      try {
        const response = await fetch(`/api/canvases/${id}`);
        if (response.ok) {
          const data = await response.json();
          setCanvas(data);
          setTitle(data.title);
          setBlocks(JSON.parse(data.blocks));
        } else {
          navigate('/canvases');
        }
      } catch (err) {
        console.error('Failed to fetch canvas:', err);
        navigate('/canvases');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCanvas();
  }, [id, user, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === 'INPUT' || target.contentEditable === 'true';

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

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId && !isEditing) {
        e.preventDefault();
        deleteBlock(selectedBlockId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, undo, redo]);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Add block
  const addBlock = useCallback(() => {
    saveState();
    const newBlock: Block = {
      id: generateId(),
      type: 'text',
      content: '',
      x: snap(40 + Math.random() * 80),
      y: snap(40 + Math.random() * 80),
      width: GRID_SIZE * 10,
      height: GRID_SIZE * 5,
    };
    setBlocks(prev => [...prev, newBlock]);
    setIsDirty(true);
  }, [saveState, snap]);

  // Delete block
  const deleteBlock = useCallback((blockId: string) => {
    saveState();
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
    setIsDirty(true);
  }, [saveState, selectedBlockId]);

  // Duplicate block
  const duplicateBlock = useCallback(() => {
    if (!selectedBlockId) return;
    const sourceBlock = blocks.find(b => b.id === selectedBlockId);
    if (!sourceBlock) return;

    saveState();
    const newBlock: Block = {
      ...sourceBlock,
      id: generateId(),
      x: sourceBlock.x + 20,
      y: sourceBlock.y + 20,
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
    setIsDirty(true);
  }, [selectedBlockId, blocks, saveState]);

  // Update block
  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...updates } : b));
    setIsDirty(true);
  }, []);

  // Save canvas
  const saveCanvas = async () => {
    setStatus('Saving...');
    try {
      const response = await fetch(`/api/canvases/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ title, blocks }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsDirty(false);
        setStatus(data.synced ? 'Saved & synced' : data.syncError ? `Saved (sync error: ${data.syncError})` : 'Saved');
      } else {
        setStatus('Error saving');
      }
    } catch (err) {
      setStatus('Error saving');
    }
  };

  // Delete canvas
  const deleteCanvas = async () => {
    try {
      const response = await fetch(`/api/canvases/${id}`, {
        method: 'DELETE',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      });

      if (response.ok) {
        navigate('/canvases');
      }
    } catch (err) {
      console.error('Failed to delete canvas:', err);
    }
  };

  // Publish canvas
  const publishCanvas = async () => {
    try {
      const response = await fetch(`/api/canvases/${id}/publish`, {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      });

      if (response.ok) {
        setStatus('Published to ATProto');
      } else {
        setStatus('Publish failed');
      }
    } catch (err) {
      setStatus('Publish failed');
    }
  };

  // Handle canvas mouse events for block creation
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target !== containerRef.current && !target.classList.contains(styles.canvasHint)) {
      return;
    }

    isCreating.current = true;
    const rect = containerRef.current!.getBoundingClientRect();
    createStart.current = {
      x: (e.clientX - rect.left) / (zoom / 100),
      y: (e.clientY - rect.top) / (zoom / 100),
    };

    if (selectionBoxRef.current) {
      selectionBoxRef.current.style.left = `${createStart.current.x}px`;
      selectionBoxRef.current.style.top = `${createStart.current.y}px`;
      selectionBoxRef.current.style.width = '0';
      selectionBoxRef.current.style.height = '0';
      selectionBoxRef.current.classList.add(styles.active);
    }

    setSelectedBlockId(null);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isCreating.current || !containerRef.current || !selectionBoxRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / (zoom / 100);
    const currentY = (e.clientY - rect.top) / (zoom / 100);

    let left = Math.min(createStart.current.x, currentX);
    let top = Math.min(createStart.current.y, currentY);
    let width = Math.abs(currentX - createStart.current.x);
    let height = Math.abs(currentY - createStart.current.y);

    left = snap(left);
    top = snap(top);
    width = snap(width);
    height = snap(height);

    selectionBoxRef.current.style.left = `${left}px`;
    selectionBoxRef.current.style.top = `${top}px`;
    selectionBoxRef.current.style.width = `${width}px`;
    selectionBoxRef.current.style.height = `${height}px`;
  }, [zoom, snap]);

  const handleMouseUp = useCallback(() => {
    if (!isCreating.current || !selectionBoxRef.current) return;
    isCreating.current = false;

    const left = parseInt(selectionBoxRef.current.style.left) || 0;
    const top = parseInt(selectionBoxRef.current.style.top) || 0;
    const width = parseInt(selectionBoxRef.current.style.width) || 0;
    const height = parseInt(selectionBoxRef.current.style.height) || 0;

    selectionBoxRef.current.classList.remove(styles.active);

    if (width >= MIN_BLOCK_SIZE && height >= MIN_BLOCK_SIZE) {
      saveState();
      const newBlock: Block = {
        id: generateId(),
        type: 'text',
        content: '',
        x: left,
        y: top,
        width: Math.max(width, GRID_SIZE * 4),
        height: Math.max(height, GRID_SIZE * 4),
      };
      setBlocks(prev => [...prev, newBlock]);
      setSelectedBlockId(newBlock.id);
      setEditingBlockId(newBlock.id);
      setIsDirty(true);
    }
  }, [saveState, snap]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  if (!user) return null;

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!canvas) return null;

  return (
    <Tooltip.Provider>
      <div className={styles.canvasApp}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <Link to="/">Leaflet</Link>
          </div>
          <nav className={styles.nav}>
            <div className={styles.navLinks}>
              <Link to="/posts">Explore</Link>
              <Link to="/profile">My Posts</Link>
              <Link to="/canvases">Canvases</Link>
            </div>
            <div className={styles.navActions}>
              <ThemeToggle />
              <button className={styles.userBtn} onClick={() => navigate('/profile')}>
                {user.handle}
              </button>
            </div>
          </nav>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <Button asChild variant="secondary" size="sm">
              <Link to="/canvases">&larr; Back</Link>
            </Button>
            <input
              type="text"
              className={styles.titleInput}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
            />
          </div>

          <div className={styles.toolbarCenter}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="secondary" size="sm" onClick={undo} disabled={undoStack.length === 0}>
                  Undo
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content className={styles.tooltip}>Ctrl+Z</Tooltip.Content>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="secondary" size="sm" onClick={redo} disabled={redoStack.length === 0}>
                  Redo
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content className={styles.tooltip}>Ctrl+Y</Tooltip.Content>
            </Tooltip.Root>

            <div className={styles.separator} />

            <Button variant="secondary" size="sm" onClick={addBlock}>
              + Add Text Block
            </Button>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="secondary" size="sm" onClick={duplicateBlock} disabled={!selectedBlockId}>
                  Duplicate
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content className={styles.tooltip}>Ctrl+D</Tooltip.Content>
            </Tooltip.Root>

            <Button
              variant={snapToGrid ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSnapToGrid(!snapToGrid)}
            >
              Grid
            </Button>
          </div>

          <div className={styles.toolbarRight}>
            <div className={styles.zoomControls}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoomIndex(Math.max(0, zoomIndex - 1))}
                disabled={zoomIndex === 0}
              >
                -
              </Button>
              <span className={styles.zoomLevel}>{zoom}%</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoomIndex(Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1))}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
              >
                +
              </Button>
            </div>

            <Button variant="primary" size="sm" onClick={saveCanvas}>
              Save
            </Button>

            <Dialog.Root>
              <Dialog.Trigger asChild>
                <Button variant="secondary" size="sm" style={{ background: '#059669', borderColor: '#059669', color: 'white' }}>
                  Publish
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={styles.dialogOverlay} />
                <Dialog.Content className={styles.dialogContent}>
                  <Dialog.Title>Publish Canvas</Dialog.Title>
                  <Dialog.Description className={styles.dialogDescription}>
                    This will publish your canvas to ATProto as a Leaflet document.
                  </Dialog.Description>
                  <div className={styles.dialogActions}>
                    <Dialog.Close asChild>
                      <Button variant="secondary" size="sm">Cancel</Button>
                    </Dialog.Close>
                    <Dialog.Close asChild>
                      <Button variant="primary" size="sm" onClick={publishCanvas}>Publish</Button>
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

            <Dialog.Root>
              <Dialog.Trigger asChild>
                <Button variant="danger" size="sm">Delete</Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={styles.dialogOverlay} />
                <Dialog.Content className={styles.dialogContent}>
                  <Dialog.Title>Delete Canvas</Dialog.Title>
                  <Dialog.Description className={styles.dialogDescription}>
                    Are you sure you want to delete this canvas? This action cannot be undone.
                  </Dialog.Description>
                  <div className={styles.dialogActions}>
                    <Dialog.Close asChild>
                      <Button variant="secondary" size="sm">Cancel</Button>
                    </Dialog.Close>
                    <Dialog.Close asChild>
                      <Button variant="danger" size="sm" onClick={deleteCanvas}>Delete</Button>
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>

        <div className={styles.viewport}>
          <div
            ref={containerRef}
            className={`${styles.container} ${snapToGrid ? styles.showGrid : ''}`}
            style={{
              width: canvas.width,
              height: canvas.height,
              transform: `scale(${zoom / 100})`,
            }}
            onMouseDown={handleCanvasMouseDown}
          >
            {blocks.length === 0 && (
              <div className={styles.canvasHint}>
                <div className={styles.canvasHintIcon}>+</div>
                Click and drag to create a card
              </div>
            )}

            {blocks.map((block) => (
              <CanvasBlock
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                isEditing={editingBlockId === block.id}
                zoom={zoom}
                snap={snap}
                onSelect={() => setSelectedBlockId(block.id)}
                onStartEdit={() => { setSelectedBlockId(block.id); setEditingBlockId(block.id); }}
                onStopEdit={() => setEditingBlockId(null)}
                onUpdate={(updates) => updateBlock(block.id, updates)}
                onDelete={() => deleteBlock(block.id)}
                onSaveState={saveState}
              />
            ))}

            <div ref={selectionBoxRef} className={styles.selectionBox} />
          </div>
        </div>

        <div className={styles.statusBar}>
          <span>{status}</span>
          <span>{canvas.width} x {canvas.height}</span>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

// Canvas Block Component
interface CanvasBlockProps {
  block: Block;
  isSelected: boolean;
  isEditing: boolean;
  zoom: number;
  snap: (value: number) => number;
  onSelect: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (updates: Partial<Block>) => void;
  onDelete: () => void;
  onSaveState: () => void;
}

function CanvasBlock({
  block,
  isSelected,
  isEditing,
  zoom,
  snap,
  onSelect,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onDelete,
  onSaveState,
}: CanvasBlockProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, origX: 0, origY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, origW: 0, origH: 0 });
  const stateSaved = useRef(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isEditing && contentRef.current) {
      contentRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]);

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    stateSaved.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      origX: block.x,
      origY: block.y,
    };
    setIsActive(true);
    e.preventDefault();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    isResizing.current = true;
    stateSaved.current = false;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      origW: block.width,
      origH: block.height,
    };
    setIsActive(true);
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        if (!stateSaved.current) {
          onSaveState();
          stateSaved.current = true;
        }
        const dx = (e.clientX - dragStart.current.x) / (zoom / 100);
        const dy = (e.clientY - dragStart.current.y) / (zoom / 100);
        onUpdate({
          x: Math.max(0, snap(dragStart.current.origX + dx)),
          y: Math.max(0, snap(dragStart.current.origY + dy)),
        });
      }

      if (isResizing.current) {
        if (!stateSaved.current) {
          onSaveState();
          stateSaved.current = true;
        }
        const dx = (e.clientX - resizeStart.current.x) / (zoom / 100);
        const dy = (e.clientY - resizeStart.current.y) / (zoom / 100);
        onUpdate({
          width: Math.max(GRID_SIZE * 4, snap(resizeStart.current.origW + dx)),
          height: Math.max(GRID_SIZE * 4, snap(resizeStart.current.origH + dy)),
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current || isResizing.current) {
        isDragging.current = false;
        isResizing.current = false;
        stateSaved.current = false;
        setIsActive(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [zoom, snap, onUpdate, onSaveState]);

  const handleContentBlur = () => {
    if (contentRef.current) {
      const newContent = contentRef.current.textContent || '';
      if (newContent !== block.content) {
        onUpdate({ content: newContent });
      }
    }
    onStopEdit();
  };

  return (
    <div
      className={`${styles.block} ${isSelected ? styles.selected : ''} ${isEditing ? styles.editing : ''} ${isActive ? styles.active : ''}`}
      style={{
        left: block.x,
        top: block.y,
        width: block.width,
        height: block.height,
      }}
    >
      <div className={styles.blockHeader}>
        <button className={styles.blockClose} onClick={onDelete} title="Delete block">
          &times;
        </button>
        <div
          className={styles.blockDrag}
          onMouseDown={(e) => { onSelect(); handleDragStart(e); }}
          title="Drag to move"
        />
      </div>
      <div
        ref={contentRef}
        className={styles.blockContent}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onClick={() => !isEditing && onStartEdit()}
        onBlur={handleContentBlur}
        onKeyDown={(e) => e.key === 'Escape' && handleContentBlur()}
      >
        {block.content}
      </div>
      <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
    </div>
  );
}
