import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lucide-react',
      '@supabase/supabase-js',
      'date-fns',
      'recharts',
    ],
  },
  appType: 'spa',
  server: {
    watch: {
      // Ignore files that shouldn't trigger HMR
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.bolt/**',
        '**/*.md',
        '**/*.sql',
        '**/*.sh',
        '**/*.ps1',
        '**/supabase/migrations/**',
        '**/supabase/functions/**',
        '**/dist/**',
        '**/deploy-*.js',
        '**/test-*.js',
        '**/debug-*.js',
        '**/trigger-*.js',
        '**/clear-*.js',
        '**/query.json',
        '**/response.json',
        '**/recent_query.json',
        '**/search_query.json',
        '**/deploy-payload.json',
      ],
    },
    hmr: {
      overlay: true,
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'apollo': ['@apollo/client', 'graphql'],
          'supabase': ['@supabase/supabase-js'],
          'charts': ['recharts'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'date': ['date-fns'],
        },
      },
    },
  },
});
