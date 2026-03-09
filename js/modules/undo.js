// ════════════════════════════════════════════════════════
//  UNDO / HISTORY
// ════════════════════════════════════════════════════════

const MAX = 50;
let stack = [];

export function snapshot(todos) {
  stack.push(JSON.parse(JSON.stringify(todos)));
  if (stack.length > MAX) stack.shift();
}

export function undo() {
  return stack.length > 0 ? stack.pop() : null;
}

export function canUndo() {
  return stack.length > 0;
}
