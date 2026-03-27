import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as fs from 'fs';
import * as path from 'path';

// Custom plugin to copy public files excluding problematic ones
function copyPublicPlugin() {
  return {
    name: 'copy-public-safe',
    closeBundle() {
      const publicDir = path.resolve(__dirname, 'public');
      const outDir = path.resolve(__dirname, 'dist');

      const copyRecursive = (src: string, dest: string) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          // Skip the problematic file
          if (entry.name === 'InkOps-01 copy.png') {
            continue;
          }

          if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true });
            }
            copyRecursive(srcPath, destPath);
          } else {
            try {
              fs.copyFileSync(srcPath, destPath);
            } catch (err) {
              // Skip files that can't be copied
              console.warn(`Skipped ${entry.name}`);
            }
          }
        }
      };

      try {
        copyRecursive(publicDir, outDir);
      } catch (err) {
        console.warn('Public copy completed with warnings');
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyPublicPlugin()],
  publicDir: 'public',
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
