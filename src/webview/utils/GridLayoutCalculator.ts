/**
 * Grid Layout Calculator
 *
 * Calculates 2-row grid distribution for 6-10 terminals in split mode.
 * Terminals are evenly distributed across 2 rows using ceil/floor division.
 *
 * Distribution examples:
 *   6 → 3+3, 7 → 4+3, 8 → 4+4, 9 → 5+4, 10 → 5+5
 */

import { GRID_LAYOUT_CONSTANTS } from '../constants/webview';

/**
 * Grid distribution result
 */
export interface GridDistribution {
  row1: number;
  row2: number;
}

/**
 * Calculate how terminals should be distributed across 2 rows.
 * Row 1 gets ceil(count/2), row 2 gets the remainder.
 */
export function calculateDistribution(count: number): GridDistribution {
  if (count <= 0) {
    return { row1: 0, row2: 0 };
  }
  const row1 = Math.ceil(count / 2);
  const row2 = count - row1;
  return { row1, row2 };
}

/**
 * Determine whether grid layout should be used.
 * Grid is activated when: split mode + 6+ terminals.
 */
export function shouldUseGrid(
  terminalCount: number,
  _panelLocation: 'sidebar' | 'panel',
  isSplitMode: boolean
): boolean {
  return terminalCount >= GRID_LAYOUT_CONSTANTS.MIN_TERMINALS_FOR_GRID && isSplitMode;
}

/**
 * Generate CSS grid-template-columns value for a given column count.
 */
export function getGridTemplateColumns(columnCount: number): string {
  return `repeat(${columnCount}, 1fr)`;
}
