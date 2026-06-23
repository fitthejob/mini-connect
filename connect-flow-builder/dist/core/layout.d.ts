import type { FlowAction } from "./types.js";
export interface Position {
    x: number;
    y: number;
}
/**
 * Computes (x, y) canvas positions for every action in the flow using a
 * layered BFS layout. The result maps action ID → Position and is suitable
 * for injection into the Connect flow JSON as UIPositions.
 *
 * Algorithm:
 *   1. BFS from startAction to assign each node a column (= BFS depth).
 *      Merge-point nodes (reachable via multiple paths) are placed at the
 *      deepest column they are first reached — i.e. the first BFS visit wins.
 *   2. Within each column, nodes are ordered by the sequence in which BFS
 *      first reaches them (breadth-first visit order).
 *   3. x = ORIGIN_X + column * COL_SPACING
 *      y = ORIGIN_Y + row_within_column * ROW_SPACING
 */
export declare function computeLayout(startActionId: string, actions: readonly FlowAction[]): Map<string, Position>;
