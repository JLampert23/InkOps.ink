// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "lucide-react",
      "@supabase/supabase-js",
      "date-fns",
      "recharts"
    ]
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcbiAgICAgICdyZWFjdCcsXG4gICAgICAncmVhY3QtZG9tJyxcbiAgICAgICdsdWNpZGUtcmVhY3QnLFxuICAgICAgJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcycsXG4gICAgICAnZGF0ZS1mbnMnLFxuICAgICAgJ3JlY2hhcnRzJyxcbiAgICBdLFxuICB9LFxuICBhcHBUeXBlOiAnc3BhJyxcbiAgc2VydmVyOiB7XG4gICAgd2F0Y2g6IHtcbiAgICAgIC8vIElnbm9yZSBmaWxlcyB0aGF0IHNob3VsZG4ndCB0cmlnZ2VyIEhNUlxuICAgICAgaWdub3JlZDogW1xuICAgICAgICAnKiovbm9kZV9tb2R1bGVzLyoqJyxcbiAgICAgICAgJyoqLy5naXQvKionLFxuICAgICAgICAnKiovLmJvbHQvKionLFxuICAgICAgICAnKiovKi5tZCcsXG4gICAgICAgICcqKi8qLnNxbCcsXG4gICAgICAgICcqKi8qLnNoJyxcbiAgICAgICAgJyoqLyoucHMxJyxcbiAgICAgICAgJyoqL3N1cGFiYXNlL21pZ3JhdGlvbnMvKionLFxuICAgICAgICAnKiovc3VwYWJhc2UvZnVuY3Rpb25zLyoqJyxcbiAgICAgICAgJyoqL2Rpc3QvKionLFxuICAgICAgICAnKiovZGVwbG95LSouanMnLFxuICAgICAgICAnKiovdGVzdC0qLmpzJyxcbiAgICAgICAgJyoqL2RlYnVnLSouanMnLFxuICAgICAgICAnKiovdHJpZ2dlci0qLmpzJyxcbiAgICAgICAgJyoqL2NsZWFyLSouanMnLFxuICAgICAgICAnKiovcXVlcnkuanNvbicsXG4gICAgICAgICcqKi9yZXNwb25zZS5qc29uJyxcbiAgICAgICAgJyoqL3JlY2VudF9xdWVyeS5qc29uJyxcbiAgICAgICAgJyoqL3NlYXJjaF9xdWVyeS5qc29uJyxcbiAgICAgICAgJyoqL2RlcGxveS1wYXlsb2FkLmpzb24nLFxuICAgICAgXSxcbiAgICB9LFxuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogdHJ1ZSxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgJ3JlYWN0LXZlbmRvcic6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXG4gICAgICAgICAgJ2Fwb2xsbyc6IFsnQGFwb2xsby9jbGllbnQnLCAnZ3JhcGhxbCddLFxuICAgICAgICAgICdzdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXG4gICAgICAgICAgJ2NoYXJ0cyc6IFsncmVjaGFydHMnXSxcbiAgICAgICAgICAncGRmJzogWydqc3BkZicsICdqc3BkZi1hdXRvdGFibGUnXSxcbiAgICAgICAgICAnZGF0ZSc6IFsnZGF0ZS1mbnMnXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFHbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLGNBQWM7QUFBQSxJQUNaLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBO0FBQUEsTUFFTCxTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsS0FBSztBQUFBLE1BQ0gsU0FBUztBQUFBLElBQ1g7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCx1QkFBdUI7QUFBQSxJQUN2QixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixnQkFBZ0IsQ0FBQyxTQUFTLFdBQVc7QUFBQSxVQUNyQyxVQUFVLENBQUMsa0JBQWtCLFNBQVM7QUFBQSxVQUN0QyxZQUFZLENBQUMsdUJBQXVCO0FBQUEsVUFDcEMsVUFBVSxDQUFDLFVBQVU7QUFBQSxVQUNyQixPQUFPLENBQUMsU0FBUyxpQkFBaUI7QUFBQSxVQUNsQyxRQUFRLENBQUMsVUFBVTtBQUFBLFFBQ3JCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
