import styles from './CanvasRenderer.module.css';

interface CanvasBlock {
  block?: {
    $type?: string;
    plaintext?: string;
  };
  x: number;
  y: number;
  width: number;
  height?: number;
}

interface CanvasRendererProps {
  blocks: CanvasBlock[];
  width?: number;
  height?: number;
}

export function CanvasRenderer({ blocks, width = 1200, height = 800 }: CanvasRendererProps) {
  // Calculate the actual bounds of the canvas based on block positions
  let maxX = width;
  let maxY = height;

  for (const block of blocks) {
    const blockRight = block.x + block.width;
    const blockBottom = block.y + (block.height || 100);
    if (blockRight > maxX) maxX = blockRight;
    if (blockBottom > maxY) maxY = blockBottom;
  }

  // Add some padding
  const canvasWidth = Math.max(width, maxX + 40);
  const canvasHeight = Math.max(height, maxY + 40);

  return (
    <div className={styles.canvasWrapper}>
      <div
        className={styles.canvas}
        style={{
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        {blocks.map((canvasBlock, index) => {
          const content = canvasBlock.block?.plaintext || '';

          return (
            <div
              key={index}
              className={styles.block}
              style={{
                left: canvasBlock.x,
                top: canvasBlock.y,
                width: canvasBlock.width,
                height: canvasBlock.height || 'auto',
                minHeight: canvasBlock.height ? undefined : 80,
              }}
            >
              <div className={styles.blockContent}>
                {content || <span className={styles.emptyBlock}>(empty)</span>}
              </div>
            </div>
          );
        })}

        {blocks.length === 0 && (
          <div className={styles.emptyCanvas}>
            This canvas is empty
          </div>
        )}
      </div>
    </div>
  );
}
