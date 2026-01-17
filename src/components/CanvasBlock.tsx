import { useState, useEffect, useRef } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import styles from './CanvasBlock.module.css';

const GRID_SIZE = 20;

export interface Block {
  id: string;
  type: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  onDuplicate: () => void;
  onSaveState: () => void;
}

export function CanvasBlock({
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
  onDuplicate,
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
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={`${styles.block} ${isSelected ? styles.selected : ''} ${isEditing ? styles.editing : ''} ${isActive ? styles.active : ''}`}
          style={{
            left: block.x,
            top: block.y,
            width: block.width,
            height: block.height,
          }}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            // Don't start drag if clicking on the resize handle or if editing
            if (target.classList.contains(styles.resizeHandle) || isEditing) return;
            onSelect();
            handleDragStart(e);
          }}
        >
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
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles.contextMenuContent}>
          <ContextMenu.Item className={styles.contextMenuItem} onSelect={onDuplicate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Duplicate
          </ContextMenu.Item>
          <ContextMenu.Separator className={styles.contextMenuSeparator} />
          <ContextMenu.Item className={styles.contextMenuItemDanger} onSelect={onDelete}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
