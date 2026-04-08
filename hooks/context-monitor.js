/**
 * ystack context monitor — PostToolUse hook
 *
 * Tracks approximate context usage and warns when it gets high.
 * Runs after every tool call. Keeps state in an env-like counter.
 */

const toolCallCount = Number.parseInt(process.env.YSTACK_TOOL_COUNT || "0", 10) + 1;

// Approximate context thresholds based on tool call count
// Average tool call consumes ~2-4k tokens of context
// Claude Code has ~200k token context window
// ~50 tool calls ≈ 60% usage, ~70 tool calls ≈ 80% usage
const WARNING_THRESHOLD = 50;
const CRITICAL_THRESHOLD = 70;

if (toolCallCount === WARNING_THRESHOLD) {
	console.log(
		"[ystack] Context usage ~60%. Consider spawning subagents for remaining work, or finish current task.",
	);
} else if (toolCallCount === CRITICAL_THRESHOLD) {
	console.log(
		"[ystack] Context usage ~80%. Finish current task soon. Use /pause to save state if needed.",
	);
} else if (toolCallCount > CRITICAL_THRESHOLD && toolCallCount % 10 === 0) {
	console.log(
		"[ystack] Context is filling up. Wrap up current work.",
	);
}

// Pass the count forward (hooks can't set env, so this is best-effort)
// In practice, Claude Code hooks don't persist state between calls.
// This serves as a template — real implementation would use a temp file.
