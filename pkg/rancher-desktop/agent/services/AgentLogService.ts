const NODE_INDENT: Record<string, number> = {
  StrategicPlanner: 0,
  'Strategic Critic': 0,
  StrategicCritic: 0,
  TacticalPlanner: 1,
  'Tactical Executor': 1,
  TacticalExecutor: 1,
  'Tactical Critic': 1,
  TacticalCritic: 1,
  Memory: 1,
};

function indentFor(nodeName: string): string {
  const n = NODE_INDENT[nodeName] ?? 1;
  return '  '.repeat(Math.max(0, n));
}

function stringifyData(data: unknown): string {
  if (data === undefined) {
    return '';
  }
  try {
    return `\n${JSON.stringify(data, null, 2)}`;
  } catch {
    return `\n${String(data)}`;
  }
}

export function agentLog(nodeName: string, message: string, data?: unknown): void {
  const prefix = `${indentFor(nodeName)}[Agent:${nodeName}] `;
  console.log(`${prefix}${message}${stringifyData(data)}`);
}

export function agentWarn(nodeName: string, message: string, data?: unknown): void {
  const prefix = `${indentFor(nodeName)}[Agent:${nodeName}] `;
  console.warn(`${prefix}${message}${stringifyData(data)}`);
}

export function agentError(nodeName: string, message: string, data?: unknown): void {
  const prefix = `${indentFor(nodeName)}[Agent:${nodeName}] `;
  console.error(`${prefix}${message}${stringifyData(data)}`);
}
