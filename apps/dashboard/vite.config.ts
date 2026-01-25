import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      port: parseInt(env.VITE_PORT || '5173', 10),
      // Security: Prevent directory traversal attacks (CVE-2025-30208)
      fs: {
        strict: true,
        // Only allow serving files from these directories
        allow: ['.'],
        // Deny access to sensitive files
        deny: ['.env', '.env.*', '*.pem', '.git/**'],
      },
      // Proxy API requests to gateway in development
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      // Disable source maps in production to prevent code exposure
      sourcemap: process.env.NODE_ENV !== 'production',
      // Rollup options for chunking
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            query: ['@tanstack/react-query'],
            charts: ['recharts'],
          },
        },
      },
      // Target modern browsers
      target: 'esnext',
    },

    // Environment variable prefix
    envPrefix: 'VITE_',
  };
});
