// Optional page tools expose progress and navigation only, never borrower data,
// credit decisions, storage mutations, policy changes or exports.
export function registerCrrTools({ context, readProgress, navigate }) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const definitions = [
    {
      name: 'read_crr_progress', title: 'Read CRR form progress',
      description: 'Read the visible form type, completion counts and policy readiness. Does not return borrower details or change data.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.');
        return readProgress();
      },
    },
    {
      name: 'navigate_crr_step', title: 'Navigate to a CRR form step',
      description: 'Open the requested step of the current assessment. Does not change answers, rate a borrower, save, export or approve anything.',
      inputSchema: { type: 'object', properties: { step: { type: 'integer', minimum: 1, maximum: 4 } }, required: ['step'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !Number.isInteger(input.step) || input.step < 1 || input.step > 4) throw new Error('Step must be an integer from 1 to 4.');
        navigate(input.step - 1);
        return readProgress();
      },
    },
  ];
  for (const tool of definitions) {
    try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* The normal form works when optional page tools are unavailable. */ }
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  return () => lifecycle.abort();
}
