import { defineConfig } from 'tsup'

export default defineConfig({
  // Entry points
  entry: {
    index: 'src/index.ts',
    'parser/index': 'src/parser/index.ts',
    'encoder/index': 'src/encoder/index.ts'
  },

  // Output formats
  format: ['esm', 'cjs'],

  // Generate declaration files
  dts: true,

  // Source maps for debugging
  sourcemap: true,

  // Clean dist before build
  clean: true,

  // Split chunks for better tree-shaking
  splitting: true,

  // Minify output
  minify: false,  // Keep readable for debugging, enable for production

  // Target ES2020 for BigInt support
  target: 'es2020',

  // No external dependencies (we have zero deps)
  external: [],

  // Tree-shaking
  treeshake: true,

  // Output directory
  outDir: 'dist',

  // Bundle analyzer (optional)
  metafile: true,

  // Platform-specific builds
  platform: 'neutral',  // Works in both Node.js and browsers

  // Custom output file names
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.js'
  })
})
