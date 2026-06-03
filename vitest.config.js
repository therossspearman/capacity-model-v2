import { defineConfig } from 'vitest/config';

// Minimal test setup. Tests live next to the code in __tests__ folders.
// Target the PURE modules (no React / no Airtable SDK imports) so the suite runs
// fast in a plain node environment. See HANDOVER.md → "Testing".
export default defineConfig({
    test: {
        environment: 'node',
        include: ['frontend/**/__tests__/**/*.test.{js,jsx}'],
    },
});
