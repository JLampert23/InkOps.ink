// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  appType: "spa",
  server: {
    watch: {
      // Ignore files that shouldn't trigger HMR
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.bolt/**",
        "**/*.md",
        "**/*.sql",
        "**/*.sh",
        "**/*.ps1",
        "**/supabase/migrations/**",
        "**/supabase/functions/**",
        "**/dist/**",
        "**/deploy-*.js",
        "**/test-*.js",
        "**/debug-*.js",
        "**/trigger-*.js",
        "**/clear-*.js",
        "**/query.json",
        "**/response.json",
        "**/recent_query.json",
        "**/search_query.json",
        "**/deploy-payload.json"
      ]
    },
    hmr: {
      overlay: true
    }
  },
  build: {
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "apollo": ["@apollo/client", "graphql"],
          "supabase": ["@supabase/supabase-js"],
          "charts": ["recharts"],
          "pdf": ["jspdf", "jspdf-autotable"],
          "date": ["date-fns"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIGFwcFR5cGU6ICdzcGEnLFxuICBzZXJ2ZXI6IHtcbiAgICB3YXRjaDoge1xuICAgICAgLy8gSWdub3JlIGZpbGVzIHRoYXQgc2hvdWxkbid0IHRyaWdnZXIgSE1SXG4gICAgICBpZ25vcmVkOiBbXG4gICAgICAgICcqKi9ub2RlX21vZHVsZXMvKionLFxuICAgICAgICAnKiovLmdpdC8qKicsXG4gICAgICAgICcqKi8uYm9sdC8qKicsXG4gICAgICAgICcqKi8qLm1kJyxcbiAgICAgICAgJyoqLyouc3FsJyxcbiAgICAgICAgJyoqLyouc2gnLFxuICAgICAgICAnKiovKi5wczEnLFxuICAgICAgICAnKiovc3VwYWJhc2UvbWlncmF0aW9ucy8qKicsXG4gICAgICAgICcqKi9zdXBhYmFzZS9mdW5jdGlvbnMvKionLFxuICAgICAgICAnKiovZGlzdC8qKicsXG4gICAgICAgICcqKi9kZXBsb3ktKi5qcycsXG4gICAgICAgICcqKi90ZXN0LSouanMnLFxuICAgICAgICAnKiovZGVidWctKi5qcycsXG4gICAgICAgICcqKi90cmlnZ2VyLSouanMnLFxuICAgICAgICAnKiovY2xlYXItKi5qcycsXG4gICAgICAgICcqKi9xdWVyeS5qc29uJyxcbiAgICAgICAgJyoqL3Jlc3BvbnNlLmpzb24nLFxuICAgICAgICAnKiovcmVjZW50X3F1ZXJ5Lmpzb24nLFxuICAgICAgICAnKiovc2VhcmNoX3F1ZXJ5Lmpzb24nLFxuICAgICAgICAnKiovZGVwbG95LXBheWxvYWQuanNvbicsXG4gICAgICBdLFxuICAgIH0sXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiB0cnVlLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3M6IHtcbiAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nXSxcbiAgICAgICAgICAnYXBvbGxvJzogWydAYXBvbGxvL2NsaWVudCcsICdncmFwaHFsJ10sXG4gICAgICAgICAgJ3N1cGFiYXNlJzogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcbiAgICAgICAgICAnY2hhcnRzJzogWydyZWNoYXJ0cyddLFxuICAgICAgICAgICdwZGYnOiBbJ2pzcGRmJywgJ2pzcGRmLWF1dG90YWJsZSddLFxuICAgICAgICAgICdkYXRlJzogWydkYXRlLWZucyddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGNBQWM7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBO0FBQUEsTUFFTCxTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsS0FBSztBQUFBLE1BQ0gsU0FBUztBQUFBLElBQ1g7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCx1QkFBdUI7QUFBQSxJQUN2QixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixnQkFBZ0IsQ0FBQyxTQUFTLFdBQVc7QUFBQSxVQUNyQyxVQUFVLENBQUMsa0JBQWtCLFNBQVM7QUFBQSxVQUN0QyxZQUFZLENBQUMsdUJBQXVCO0FBQUEsVUFDcEMsVUFBVSxDQUFDLFVBQVU7QUFBQSxVQUNyQixPQUFPLENBQUMsU0FBUyxpQkFBaUI7QUFBQSxVQUNsQyxRQUFRLENBQUMsVUFBVTtBQUFBLFFBQ3JCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
