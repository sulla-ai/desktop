import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

type NodeSummary = {
  name: string;
  ready: boolean;
  status: string;
  kubeletVersion?: string;
  osImage?: string;
  kernelVersion?: string;
  containerRuntime?: string;
  roles?: string;
  internalIP?: string;
};

export class KubectlListNodesTool extends BaseTool {
  override readonly name = 'kubectl_list_nodes';
  override readonly category = 'kubernetes_read';

  override getPlanningInstructions(): string {
    return [
      '4) kubectl_list_nodes (Kubernetes via kubectl)',
      '   - Purpose: List nodes and summarize readiness and key node details.',
      '   - Output: Per-node readiness, status, versions, runtime, and internal IP.',
      '   - Use when:',
      '     - User asks for node health, capacity issues, or cluster availability.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_list_nodes" before generating the final response.',
    ].join('\n');
  }

  override async execute(state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    const res = await runCommand('kubectl', ['get', 'nodes', '-o', 'json']);

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || 'kubectl command failed',
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(res.stdout);
    } catch {
      return { toolName: this.name, success: false, error: 'Failed to parse kubectl JSON output' };
    }

    const items: any[] = Array.isArray(parsed?.items) ? parsed.items : [];

    const summaries: NodeSummary[] = items.map(n => {
      const name = String(n?.metadata?.name || '');

      const conditions: any[] = Array.isArray(n?.status?.conditions) ? n.status.conditions : [];
      const readyCond = conditions.find(c => c?.type === 'Ready');
      const ready = String(readyCond?.status || '') === 'True';

      const status = ready ? 'Ready' : `NotReady${readyCond?.reason ? ` (${readyCond.reason})` : ''}`;

      const nodeInfo = n?.status?.nodeInfo || {};

      const roles = (() => {
        const labels = n?.metadata?.labels || {};
        const roleKeys = Object.keys(labels).filter(k => k.startsWith('node-role.kubernetes.io/'));
        if (roleKeys.length === 0) {
          return '';
        }
        return roleKeys.map(k => k.replace('node-role.kubernetes.io/', '') || '');
      })();

      const addresses: any[] = Array.isArray(n?.status?.addresses) ? n.status.addresses : [];
      const internalIP = addresses.find(a => a?.type === 'InternalIP')?.address;

      return {
        name,
        ready,
        status,
        kubeletVersion: nodeInfo.kubeletVersion,
        osImage: nodeInfo.osImage,
        kernelVersion: nodeInfo.kernelVersion,
        containerRuntime: nodeInfo.containerRuntimeVersion,
        roles: Array.isArray(roles) ? roles.join(',') : roles,
        internalIP: internalIP ? String(internalIP) : undefined,
      };
    });

    const readyCount = summaries.filter(s => s.ready).length;

    const result = {
      total: summaries.length,
      ready: readyCount,
      notReady: summaries.length - readyCount,
      nodes: summaries,
    };

    (state.metadata as any).kubectlNodes = result;

    return { toolName: this.name, success: true, result };
  }
}
