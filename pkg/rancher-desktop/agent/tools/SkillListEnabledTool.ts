import type { ThreadState, ToolResult } from '../types';
import { getSkillService } from '../services/SkillService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class SkillListEnabledTool extends BaseTool {
  override readonly name = 'skill_list_enabled';
  override readonly category = 'skills';

  override getPlanningInstructions(): string {
    return [
      '38) skill_list_enabled (Skills)',
      '   - Purpose: List all enabled skills that are ready to run.',
      '   - Args: none',
      '   - Output: Array of enabled skills with id, name, and description.',
      '   - Use this to discover what skills are currently enabled and available for execution.',
      '   - To run a skill: skill_run_plugin { skillId: "skill_id", args: { ... } }',
    ].join('\n');
  }

  override async execute(_state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    try {
      const svc = getSkillService();
      await svc.initialize();

      const enabledSkills = await svc.listEnabledSkills();

      const skillList = enabledSkills.map(s => ({
        id: s.id,
        name: s.title || s.id,
        description: s.description || '',
      }));

      return {
        toolName: this.name,
        success: true,
        result: skillList,
      };
    } catch (err) {
      return {
        toolName: this.name,
        success: false,
        error: `Failed to list enabled skills: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
