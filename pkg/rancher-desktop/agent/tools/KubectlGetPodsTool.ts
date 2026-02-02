import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

type PodSummary = {
  namespace: string;
  name: string;
  phase: string;
  ready: string;
  restarts: number;
  node?: string;
};

export class KubectlGetPodsTool extends BaseTool {
  override readonly name = 'kubectl_get_pods';
  override readonly category = 'kubernetes_read';

  override getPlanningInstructions(): string {
    return [
      '39) kubectl_get_pods (Kubernetes via kubectl)',
      '   - Purpose: Get pods in a namespace, optionally filtered by label selector.',
      '   - Args:',
      '     - namespace (string, optional, default "default")',
      '     - selector (string, optional) Label selector (e.g. "app=my-app")',
      '   - Output: Per-pod status including name, phase, readiness, restarts, and node (when available).',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Use selector to keep the result set small and targeted.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = context.args?.namespace ? String(context.args.namespace) : 'default';
    const selector = context.args?.selector ? String(context.args.selector) : '';

    const jsonPath = [
      '{range .items[*]}',
      '{.metadata.namespace}',
      '\t',
      '{.metadata.name}',
      '\t',
      '{.status.phase}',
      '\t',
      '{.spec.nodeName}',
      '\t',
      '{range .status.containerStatuses[*]}{.ready}{","}{end}',
      '\t',
      '{range .status.containerStatuses[*]}{.restartCount}{","}{end}',
      '{"\\n"}',
      '{end}',
    ].join('');

    const args = ['get', 'pods', '-n', ns];
    if (selector.trim()) {
      args.push('-l', selector);
    }
    args.push('-o', `jsonpath=${jsonPath}`);

    const res = await runCommand('kubectl', args, { timeoutMs: 30_000, maxOutputChars: 400_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl get pods failed' };
    }

    const stdout = res.stdout.trim();
    const lines = stdout ? stdout.split('\n').filter(Boolean) : [];

    const pods: PodSummary[] = [];

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 6) {
        continue;
      }

      const [nsOut, name, phase, nodeRaw, readyRaw, restartsRaw] = parts;
      const readyParts = String(readyRaw || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const readyCount = readyParts.filter(v => v === 'true' || v === 'True').length;
      const totalCount = readyParts.length;

      const restartParts = String(restartsRaw || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const restarts = restartParts.reduce((acc, s) => acc + (Number(s) || 0), 0);

      pods.push({
        namespace: String(nsOut || ns),
        name: String(name || ''),
        phase: String(phase || ''),
        ready: `${readyCount}/${totalCount}`,
        restarts,
        node: nodeRaw ? String(nodeRaw) : undefined,
      });
    }

    const phaseCounts = pods.reduce<Record<string, number>>((acc, p) => {
      acc[p.phase] = (acc[p.phase] || 0) + 1;
      return acc;
    }, {});

    const result = {
      namespace: ns,
      selector: selector || undefined,
      total: pods.length,
      phaseCounts,
      pods,
    };

    (state.metadata as any).kubectlGetPods = result;

    return { toolName: this.name, success: true, result };
  }
}
