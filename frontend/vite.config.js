import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        customers: resolve(__dirname, 'customers.html'),
        inventory: resolve(__dirname, 'inventory.html'),
        purchases: resolve(__dirname, 'purchases.html'),
        sales: resolve(__dirname, 'sales.html'),
        suppliers: resolve(__dirname, 'suppliers.html'),
        expenses: resolve(__dirname, 'expenses.html'),
        debts: resolve(__dirname, 'debts.html'),
        reports: resolve(__dirname, 'reports.html'),
        debug: resolve(__dirname, 'debug.html')
      }
    }
  }
});