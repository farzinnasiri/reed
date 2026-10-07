const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Correctness diagnostics also apply without enabling the React Compiler.
    // Render state and effects follow the same correctness rules throughout the app.
    rules: {
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/preserve-manual-memoization': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/immutability': 'error',
      '@typescript-eslint/array-type': 'off',
    },
  },
  {
    // These components update Reanimated SharedValue objects through the native API.
    // React's immutability rule treats those objects as ordinary immutable hook results.
    files: [
      'components/home/pulse/pulse.tsx', 'components/reed/today/today-view.tsx',
      'components/ui/reed-sheet.tsx', 'components/ui/segmented-control.tsx',
      'components/workout/workout-metric-picker.tsx', 'components/workout/workout-swipe-card.tsx',
      'design/use-press-animation.ts',
    ],
    rules: { 'react-hooks/immutability': 'off' },
  },
  {
    ignores: [
      '.expo/**', 'convex/**', 'control-panel/**', 'legacy/**', 'tmp/**', 'exports/**',
      '.scratch/**', 'prototypes/**', '.agents/**',
      'components/onboarding/**',
    ],
  },
]);
