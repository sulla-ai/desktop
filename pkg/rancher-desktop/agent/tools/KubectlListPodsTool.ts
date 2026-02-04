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

export class KubectlListPodsTool extends BaseTool {
  override readonly name = 'kubectl_list_pods';
  override readonly category = 'kubernetes_read';

  override getPlanningInstructions(): string {
    return [
      '3) kubectl_list_pods (Kubernetes via kubectl)',
      '   - Purpose: List pods in a namespace (or all namespaces) and summarize status/health.',
      '   - Output: Per-pod status including namespace, name, phase, readiness, restarts, and node (when available).',
      '   - Use when:',
      '     - User asks for cluster status, what is running, or whether workloads are healthy.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_list_pods" before generating the final response.',
    ].join('\n');
  }

  override async execute(state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    // Avoid `-o json` because large clusters can exceed max output and `runCommand`
    // appends `...<truncated>`, which breaks JSON parsing.
    // We use a deterministic tab-delimited jsonpath instead.
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

    const res = await runCommand('kubectl', ['get', 'pods', '-A', '-o', `jsonpath=${jsonPath}`], {
      timeoutMs:  30_000,
      maxOutputChars: 400_000,
    });

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || 'kubectl command failed',
      };
    }

    const stdout = res.stdout.trim();
    const lines = stdout ? stdout.split('\n').filter(Boolean) : [];

    const summaries: PodSummary[] = [];

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 6) {
        continue;
      }

      const [ns, name, phase, nodeRaw, readyRaw, restartsRaw] = parts;
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

      summaries.push({
        namespace: String(ns || ''),
        name: String(name || ''),
        phase: String(phase || ''),
        ready: `${readyCount}/${totalCount}`,
        restarts,
        node: nodeRaw ? String(nodeRaw) : undefined,
      });
    }

    const phaseCounts = summaries.reduce<Record<string, number>>((acc, s) => {
      acc[s.phase] = (acc[s.phase] || 0) + 1;
      return acc;
    }, {});

    const nonRunning = summaries.filter(s => s.phase !== 'Running' && s.phase !== 'Succeeded');
    const topRestarts = [...summaries].sort((a, b) => b.restarts - a.restarts).slice(0, 10);

    const result = {
      total: summaries.length,
      phaseCounts,
      nonRunning: nonRunning.slice(0, 25),
      topRestarts,
      pods: summaries.slice(0, 200),
    };

    (state.metadata as any).kubectlPods = result;

    return { toolName: this.name, success: true, result };
  }
}
