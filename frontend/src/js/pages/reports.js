// reports.js - Optimized Reports Module Implementation
import apiClient from '../apiClient.js';
import notificationManager from '../utils/notifications.js';

class ReportsManager {
    constructor() {
        this.currentStockData = [];
        this.currentLowStockData = [];
        this.currentSummaryData = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadAllReports();
        this.setDefaultDates();
    }

    setupEventListeners() {
        // Menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', this.toggleSidebar);
        
        // Refresh buttons
        document.getElementById('refreshStock')?.addEventListener('click', () => this.loadStockReport());
        document.getElementById('refreshLowStock')?.addEventListener('click', () => this.loadLowStockReport());
        document.getElementById('refreshSummary')?.addEventListener('click', () => this.loadSalesPurchaseSummary());
        
        // Date filters
        document.getElementById('applySummaryFilters')?.addEventListener('click', () => this.applyDateFilters());
        
        // Export dropdowns
        this.setupExportDropdowns();
        
        // Export handlers
        this.setupExportHandlers();
        
        // Close dropdowns on outside click
        document.addEventListener('click', this.closeDropdowns);
        
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', this.handleLogout);
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        sidebar?.classList.toggle('collapsed');
        mainContent?.classList.toggle('expanded');
    }

    setupExportDropdowns() {
        document.querySelectorAll('.export-dropdown button[id$="Btn"]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = button.nextElementSibling;
                this.toggleDropdown(dropdown);
            });
        });
    }

    toggleDropdown(dropdown) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            if (menu !== dropdown) menu.classList.remove('show');
        });
        dropdown?.classList.toggle('show');
    }

    closeDropdowns() {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }

    setupExportHandlers() {
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const format = item.dataset.format;
                const menu = item.closest('.dropdown-menu');
                const reportType = this.getReportTypeFromMenu(menu.id);
                this.exportReport(reportType, format);
                menu.classList.remove('show');
            });
        });
    }

    getReportTypeFromMenu(menuId) {
        const typeMap = {
            'exportStockMenu': 'stock',
            'exportLowStockMenu': 'low_stock',
            'exportSummaryMenu': 'sales_purchase_summary'
        };
        return typeMap[menuId] || 'stock';
    }

    setDefaultDates() {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        
        const startDateInput = document.getElementById('summaryStartDate');
        const endDateInput = document.getElementById('summaryEndDate');
        
        if (startDateInput) startDateInput.value = this.formatDate(lastMonth);
        if (endDateInput) endDateInput.value = this.formatDate(today);
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    async loadAllReports() {
        await Promise.all([
            this.loadStockReport(),
            this.loadLowStockReport(),
            this.loadSalesPurchaseSummary()
        ]);
    }

    async loadStockReport() {
        try {
            this.showLoading('stockLoading');
            const data = await apiClient.get('/reports/stock/');
            this.currentStockData = data;
            this.renderStockTable(data);
        } catch (error) {
            this.showError('Failed to load stock report: ' + error.message);
        } finally {
            this.hideLoading('stockLoading');
        }
    }

    async loadLowStockReport() {
        try {
            this.showLoading('lowStockLoading');
            const data = await apiClient.get('/reports/low_stock/');
            this.currentLowStockData = data;
            this.renderLowStockTable(data);
        } catch (error) {
            this.showError('Failed to load low stock report: ' + error.message);
        } finally {
            this.hideLoading('lowStockLoading');
        }
    }

    async loadSalesPurchaseSummary() {
        try {
            const startDate = document.getElementById('summaryStartDate')?.value;
            const endDate = document.getElementById('summaryEndDate')?.value;
            
            let url = '/reports/sales_purchase_summary/';
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += '?' + params.toString();
            
            const data = await apiClient.get(url);
            this.currentSummaryData = data;
            this.renderSummaryCards(data);
        } catch (error) {
            this.showError('Failed to load sales summary: ' + error.message);
        }
    }

    renderStockTable(data) {
        const tbody = document.getElementById('stockTableBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6" class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>No stock data available</p>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(item => `
            <tr>
                <td>${item.name || 'N/A'}</td>
                <td>${item.category__name || 'N/A'}</td>
                <td>${item.quantity_in_stock || 0}</td>
                <td>${item.unit || 'N/A'}</td>
                <td>${item.reorder_level || 0}</td>
                <td>${this.getStockStatus(item.quantity_in_stock, item.reorder_level)}</td>
            </tr>
        `).join('');
    }

    renderLowStockTable(data) {
        const tbody = document.getElementById('lowStockTableBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="5" class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>No low stock items found</p>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(item => `
            <tr>
                <td>${item.name || 'N/A'}</td>
                <td>${item.quantity_in_stock || 0}</td>
                <td>${item.reorder_level || 0}</td>
                <td>${item.unit || 'N/A'}</td>
                <td>
                    <span class="badge bg-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        Reorder Required
                    </span>
                </td>
            </tr>
        `).join('');
    }

    renderSummaryCards(data) {
        const totalSales = data.total_sales || 0;
        const totalPurchases = data.total_purchases || 0;
        const grossProfit = totalSales - totalPurchases;

        this.updateElement('totalSales', this.formatCurrency(totalSales));
        this.updateElement('totalPurchases', this.formatCurrency(totalPurchases));
        this.updateElement('profitMargin', this.formatCurrency(grossProfit));
    }

    getStockStatus(current, reorder) {
        if (current <= reorder) {
            return '<span class="badge bg-danger"><i class="fas fa-exclamation-triangle"></i> Low Stock</span>';
        } else if (current <= reorder * 1.5) {
            return '<span class="badge bg-warning"><i class="fas fa-exclamation-circle"></i> Warning</span>';
        }
        return '<span class="badge bg-success"><i class="fas fa-check-circle"></i> Good</span>';
    }

    async exportReport(type, format) {
        try {
            const params = new URLSearchParams({ type, format });
            
            // Add date filters for summary reports
            if (type === 'sales_purchase_summary') {
                const startDate = document.getElementById('summaryStartDate')?.value;
                const endDate = document.getElementById('summaryEndDate')?.value;
                if (startDate) params.append('start_date', startDate);
                if (endDate) params.append('end_date', endDate);
            }

            const url = `/reports/export/?${params.toString()}`;
            
            if (format === 'json') {
                const data = await apiClient.get(url);
                this.downloadJson(data, type);
            } else {
                // For CSV and PDF, we need to handle file download
                const response = await apiClient.get(url, {
                    responseType: 'blob'
                });
                
                const blob = response.data;
                this.downloadFile(blob, `${type}.${format}`);
            }
            
            this.showSuccess(`${type} report exported as ${format.toUpperCase()}`);
        } catch (error) {
            this.showError('Export failed: ' + error.message);
        }
    }

    downloadJson(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadFile(blob, `${filename}.json`);
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    applyDateFilters() {
        const startDate = document.getElementById('summaryStartDate')?.value;
        const endDate = document.getElementById('summaryEndDate')?.value;
        
        if (startDate && endDate && startDate > endDate) {
            this.showError('Start date cannot be after end date');
            return;
        }
        
        this.loadSalesPurchaseSummary();
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.style.display = 'block';
    }

    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.style.display = 'none';
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    showSuccess(message) {
        notificationManager.showSuccess(message);
    }

    showError(message) {
        notificationManager.showError(message);
        console.error('Reports Error:', message);
    }

    showWarning(message) {
        notificationManager.showWarning(message);
    }

    showInfo(message) {
        notificationManager.showInfo(message);
    }

    showToast(message, type = 'info') {
        // Legacy method - map to new notification system
        const typeMap = {
            'success': 'success',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        notificationManager.showNotification(message, typeMap[type] || 'info');
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    }
}

// Initialize the reports manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ReportsManager();
});