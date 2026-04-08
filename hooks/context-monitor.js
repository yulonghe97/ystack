/**
 * ystack context monitor — PostToolUse hook
 *
 * Warns when context usage gets high. Uses runtime-provided
 * context metrics when available, stays silent otherwise.
 *
 * Supported env vars (set by the runtime):
 *   CLAUDE_CONTEXT_TOKENS_USED  — tokens consumed so far
 *   CLAUDE_CONTEXT_TOKENS_MAX   — total context window size
 */

const used = Number.parseInt(process.env.CLAUDE_CONTEXT_TOKENS_USED || "0", 10);
const max = Number.parseInt(process.env.CLAUDE_CONTEXT_TOKENS_MAX || "0", 10);

// If the runtime doesn't expose context metrics, stay silent
if (!used || !max) {
	process.exit(0);
}

const pct = Math.round((used / max) * 100);

if (pct >= 80) {
	console.log(
		`[ystack] Context ${pct}% full. Finish current task soon. Use /pause to save state if needed.`,
	);
} else if (pct >= 60) {
	console.log(
		`[ystack] Context ${pct}% full. Consider spawning subagents for remaining work.`,
	);
}
