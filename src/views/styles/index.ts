// Central export for all styles

import { cssVariables } from './variables.ts';
import { baseStyles, canvasBodyStyles } from './base.ts';
import { componentStyles } from './components.ts';
import { layoutStyles } from './layout.ts';
import { allPostStyles } from './post.ts';
import { utilityStyles } from './utilities.ts';
import { allCanvasStyles } from './canvas.ts';

// Main layout stylesheet - combines all styles needed for regular pages
export const mainStylesheet = `
  ${cssVariables}
  ${baseStyles}
  ${componentStyles}
  ${layoutStyles}
  ${allPostStyles}
  ${utilityStyles}
`;

// Canvas layout stylesheet - combines all styles needed for canvas editor
export const canvasStylesheet = `
  ${cssVariables}
  ${canvasBodyStyles}
  ${allCanvasStyles}
`;

// Re-export individual style modules for fine-grained control
export { cssVariables } from './variables.ts';
export { baseStyles, canvasBodyStyles } from './base.ts';
export {
  buttonStyles,
  cardStyles,
  formStyles,
  messageStyles,
  paginationStyles,
  themeToggleStyles,
  componentStyles
} from './components.ts';
export { headerStyles, navStyles, mainStyles, footerStyles, layoutStyles } from './layout.ts';
export { postStyles, postContentStyles, allPostStyles } from './post.ts';
export { utilityStyles } from './utilities.ts';
export {
  canvasLayoutStyles,
  canvasThemeToggleStyles,
  canvasToolbarStyles,
  canvasViewportStyles,
  canvasBlockStyles,
  canvasStatusBarStyles,
  allCanvasStyles
} from './canvas.ts';
