// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHdhdGNoOiB7XG4gICAgICAvLyBJZ25vcmUgZmlsZXMgdGhhdCBzaG91bGRuJ3QgdHJpZ2dlciBITVJcbiAgICAgIGlnbm9yZWQ6IFtcbiAgICAgICAgJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgICAgICcqKi8uZ2l0LyoqJyxcbiAgICAgICAgJyoqLy5ib2x0LyoqJyxcbiAgICAgICAgJyoqLyoubWQnLFxuICAgICAgICAnKiovKi5zcWwnLFxuICAgICAgICAnKiovKi5zaCcsXG4gICAgICAgICcqKi8qLnBzMScsXG4gICAgICAgICcqKi9zdXBhYmFzZS9taWdyYXRpb25zLyoqJyxcbiAgICAgICAgJyoqL3N1cGFiYXNlL2Z1bmN0aW9ucy8qKicsXG4gICAgICAgICcqKi9kaXN0LyoqJyxcbiAgICAgICAgJyoqL2RlcGxveS0qLmpzJyxcbiAgICAgICAgJyoqL3Rlc3QtKi5qcycsXG4gICAgICAgICcqKi9kZWJ1Zy0qLmpzJyxcbiAgICAgICAgJyoqL3RyaWdnZXItKi5qcycsXG4gICAgICAgICcqKi9jbGVhci0qLmpzJyxcbiAgICAgICAgJyoqL3F1ZXJ5Lmpzb24nLFxuICAgICAgICAnKiovcmVzcG9uc2UuanNvbicsXG4gICAgICAgICcqKi9yZWNlbnRfcXVlcnkuanNvbicsXG4gICAgICAgICcqKi9zZWFyY2hfcXVlcnkuanNvbicsXG4gICAgICAgICcqKi9kZXBsb3ktcGF5bG9hZC5qc29uJyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IHRydWUsXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICdyZWFjdC12ZW5kb3InOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgICAgICdhcG9sbG8nOiBbJ0BhcG9sbG8vY2xpZW50JywgJ2dyYXBocWwnXSxcbiAgICAgICAgICAnc3VwYWJhc2UnOiBbJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcyddLFxuICAgICAgICAgICdjaGFydHMnOiBbJ3JlY2hhcnRzJ10sXG4gICAgICAgICAgJ3BkZic6IFsnanNwZGYnLCAnanNwZGYtYXV0b3RhYmxlJ10sXG4gICAgICAgICAgJ2RhdGUnOiBbJ2RhdGUtZm5zJ10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBR2xCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUE7QUFBQSxNQUVMLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLGdCQUFnQixDQUFDLFNBQVMsV0FBVztBQUFBLFVBQ3JDLFVBQVUsQ0FBQyxrQkFBa0IsU0FBUztBQUFBLFVBQ3RDLFlBQVksQ0FBQyx1QkFBdUI7QUFBQSxVQUNwQyxVQUFVLENBQUMsVUFBVTtBQUFBLFVBQ3JCLE9BQU8sQ0FBQyxTQUFTLGlCQUFpQjtBQUFBLFVBQ2xDLFFBQVEsQ0FBQyxVQUFVO0FBQUEsUUFDckI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
