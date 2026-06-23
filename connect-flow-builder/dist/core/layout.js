const COL_SPACING = 220;
const ROW_SPACING = 120;
const ORIGIN_X = 20;
const ORIGIN_Y = 20;
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
export function computeLayout(startActionId, actions) {
    const actionMap = new Map(actions.map((a) => [a.id, a]));
    // BFS
    const column = new Map();
    const queue = [startActionId];
    column.set(startActionId, 0);
    while (queue.length > 0) {
        const id = queue.shift();
        const action = actionMap.get(id);
        if (!action?.transitions)
            continue;
        const currentCol = column.get(id) ?? 0;
        const nextCol = currentCol + 1;
        const neighbors = collectNeighbors(action);
        for (const neighborId of neighbors) {
            if (!column.has(neighborId)) {
                column.set(neighborId, nextCol);
                queue.push(neighborId);
            }
        }
    }
    // Any actions not reachable from startAction (should not happen in a valid
    // flow, but handle gracefully) get appended in a final column.
    const maxCol = column.size > 0 ? Math.max(...column.values()) : 0;
    let unreachableRow = 0;
    for (const action of actions) {
        if (!column.has(action.id)) {
            column.set(action.id, maxCol + 1);
            unreachableRow++;
        }
    }
    // Group by column, preserving BFS visit order within each column.
    const byColumn = new Map();
    for (const [id, col] of column) {
        if (!byColumn.has(col))
            byColumn.set(col, []);
        byColumn.get(col).push(id);
    }
    // Assign positions.
    const positions = new Map();
    for (const [col, ids] of byColumn) {
        ids.forEach((id, row) => {
            positions.set(id, {
                x: ORIGIN_X + col * COL_SPACING,
                y: ORIGIN_Y + row * ROW_SPACING,
            });
        });
    }
    return positions;
}
function collectNeighbors(action) {
    const neighbors = [];
    const t = action.transitions;
    if (!t)
        return neighbors;
    if (t.nextAction)
        neighbors.push(t.nextAction);
    for (const c of t.conditions ?? [])
        neighbors.push(c.nextAction);
    for (const e of t.errors ?? [])
        neighbors.push(e.nextAction);
    // Deduplicate while preserving order (nextAction → conditions → errors).
    return [...new Set(neighbors)];
}
