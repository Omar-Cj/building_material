// dashboard.js - Optimized Dashboard Logic
import apiClient from '../apiClient.js';
import notificationManager from '../utils/notifications.js';

class Dashboard {
    constructor() {
        this.charts = {};
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadDashboardData();
        this.initializeCharts();
        this.setupResponsive();
    }

    setupEventListeners() {
        // Menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', this.toggleSidebar);
        
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', this.handleLogout);
        
        // Window resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    }

    async loadDashboardData() {
        try {
            // Load all dashboard data concurrently
            const [inventoryValue, topSelling, activities, monthlySummary, summaryCounts, debtSummary, inventoryStatus] = await Promise.all([
                this.getInventoryValue(),
                this.getTopSellingMaterials(),
                this.getRecentActivities(),
                this.getMonthlySummary(),
                this.getSummaryCounts(),
                this.getDebtSummary(),
                this.getInventoryStatus()
            ]);

            // Update UI with fetched data
            this.updateStatCards(inventoryValue, monthlySummary);
            this.updateBusinessStats(summaryCounts);
            this.updateDebtCards(debtSummary);
            this.updateRecentActivities(activities);
            this.updateRecentDebts(debtSummary.recent_activities);
            this.updateInventoryTable(inventoryStatus.inventory_status);
            this.updateFinancialMetrics(monthlySummary);
            
            // Store data for charts
            this.dashboardData = {
                monthlySummary,
                topSelling,
                inventoryValue,
                debtSummary
            };

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async getInventoryValue() {
        try {
            return await apiClient.get('/dashboard/inventory-value/');
        } catch (error) {
            console.error('Error fetching inventory value:', error);
            return { total_inventory_value: 0 };
        }
    }

    async getTopSellingMaterials() {
        try {
            return await apiClient.get('/dashboard/top-selling-materials/?limit=5');
        } catch (error) {
            console.error('Error fetching top selling materials:', error);
            return [];
        }
    }

    async getRecentActivities() {
        try {
            return await apiClient.get('/dashboard/recent-activities/?limit=5');
        } catch (error) {
            console.error('Error fetching recent activities:', error);
            return [];
        }
    }

    async getMonthlySummary() {
        try {
            const currentYear = new Date().getFullYear();
            return await apiClient.get(`/dashboard/monthly-summary/?year=${currentYear}`);
        } catch (error) {
            console.error('Error fetching monthly summary:', error);
            return {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                sales: new Array(12).fill(0),
                purchases: new Array(12).fill(0),
                expenses: new Array(12).fill(0)
            };
        }
    }

    async getSummaryCounts() {
        try {
            return await apiClient.get('/dashboard/summary-counts/');
        } catch (error) {
            console.error('Error fetching summary counts:', error);
            return {
                total_customers: 0,
                total_suppliers: 0,
                total_categories: 0,
                low_stock_items: 0
            };
        }
    }

    async getDebtSummary() {
        try {
            return await apiClient.get('/dashboard/debt-summary/');
        } catch (error) {
            console.error('Error fetching debt summary:', error);
            return {
                total_debt_amount: 0,
                outstanding_amount: 0,
                overdue_count: 0,
                overdue_amount: 0,
                status_distribution: {},
                recent_activities: [],
                collection_rate: 0
            };
        }
    }

    async getInventoryStatus() {
        try {
            return await apiClient.get('/dashboard/inventory-status/?limit=5');
        } catch (error) {
            console.error('Error fetching inventory status:', error);
            return {
                inventory_status: [],
                total_materials: 0,
                low_stock_count: 0
            };
        }
    }

    updateStatCards(inventoryData, monthlyData) {
        const currentMonth = new Date().getMonth();
        
        // Update main stat cards
        this.updateElement('totalInventoryValue', this.formatCurrency(inventoryData.total_inventory_value));
        this.updateElement('monthlySales', this.formatCurrency(monthlyData.sales[currentMonth]));
        this.updateElement('monthlyPurchases', this.formatCurrency(monthlyData.purchases[currentMonth]));
        this.updateElement('monthlyExpenses', this.formatCurrency(monthlyData.expenses[currentMonth]));
    }

    updateBusinessStats(summaryData) {
        try {
            this.updateElement('totalCustomers', summaryData.total_customers || 0);
            this.updateElement('totalSuppliers', summaryData.total_suppliers || 0);
            this.updateElement('totalCategories', summaryData.total_categories || 0);
            this.updateElement('lowStockItems', summaryData.low_stock_items || 0);
        } catch (error) {
            console.error('Error updating business stats:', error);
        }
    }

    updateDebtCards(debtData) {
        try {
            this.updateElement('totalOutstandingDebt', this.formatCurrency(debtData.outstanding_amount || 0));
            this.updateElement('overdueDebts', debtData.overdue_count || 0);
            this.updateElement('collectionRate', `${(debtData.collection_rate || 0).toFixed(1)}%`);
            this.updateElement('overdueAmount', this.formatCurrency(debtData.overdue_amount || 0));
        } catch (error) {
            console.error('Error updating debt cards:', error);
        }
    }

    updateRecentDebts(recentDebts) {
        const container = document.getElementById('recentDebts');
        if (!container) return;

        container.innerHTML = '';
        
        if (!recentDebts || recentDebts.length === 0) {
            container.innerHTML = '<p class="text-muted">No recent debt activities</p>';
            return;
        }

        recentDebts.forEach(debt => {
            const debtDiv = document.createElement('div');
            debtDiv.className = 'debt-activity-item mb-3';
            const statusClass = debt.is_overdue ? 'text-danger' : 'text-muted';
            const statusIcon = debt.is_overdue ? 'fa-exclamation-triangle' : 'fa-clock';
            
            debtDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${debt.customer_name}</h6>
                        <p class="mb-1 small">
                            <strong>${this.formatCurrency(debt.remaining_amount)}</strong> outstanding
                        </p>
                        <small class="${statusClass}">
                            <i class="fas ${statusIcon} me-1"></i>
                            ${debt.is_overdue ? 'Overdue' : 'Due'}: ${this.formatDate(debt.due_date)}
                        </small>
                    </div>
                    <div class="text-end">
                        <span class="badge ${this.getDebtStatusClass(debt.status)}">${this.formatDebtStatus(debt.status)}</span>
                    </div>
                </div>
            `;
            container.appendChild(debtDiv);
        });
    }

    updateRecentActivities(activities) {
        const container = document.getElementById('recentActivities');
        if (!container) return;

        container.innerHTML = '';
        
        activities.forEach(activity => {
            const activityDiv = document.createElement('div');
            activityDiv.className = 'activity-item';
            activityDiv.innerHTML = `
                <div class="activity-avatar">
                    <i class="fas ${this.getActivityIcon(activity.module)}"></i>
                </div>
                <div class="activity-content">
                    <h6>${activity.user} - ${activity.action}</h6>
                    <p>${activity.description}</p>
                </div>
                <div class="activity-time">${this.getTimeAgo(activity.timestamp)}</div>
            `;
            container.appendChild(activityDiv);
        });
    }

    updateInventoryTable(inventoryData) {
        const container = document.getElementById('inventoryStatusList');
        if (!container) return;

        container.innerHTML = '';
        
        if (!inventoryData || inventoryData.length === 0) {
            container.innerHTML = '<p class="text-muted">No inventory data available</p>';
            return;
        }

        inventoryData.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item mb-3';
            const statusClass = this.getStatusClass(item.status);
            const stockStatusClass = item.status === 'Critical' || item.status === 'Low' ? 'text-danger' : 'text-muted';
            
            itemDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <div class="inventory-icon me-2">
                                <i class="fas fa-cube"></i>
                            </div>
                            <div>
                                <h6 class="mb-0">${item.material}</h6>
                                <small class="text-muted">SKU: ${item.sku}</small>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="${stockStatusClass}">
                                <i class="fas fa-warehouse me-1"></i>
                                ${item.stock.toFixed(1)} ${item.unit} in stock
                            </small>
                            <small class="text-muted">${this.formatCurrency(item.value)}</small>
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="badge ${statusClass}">${item.status}</span>
                    </div>
                </div>
            `;
            container.appendChild(itemDiv);
        });
    }

    updateFinancialMetrics(monthlyData) {
        const currentMonth = new Date().getMonth();
        const sales = monthlyData.sales[currentMonth];
        const expenses = monthlyData.expenses[currentMonth];
        const profit = sales - expenses;
        
        const profitMargin = sales > 0 ? ((profit / sales) * 100).toFixed(1) : 0;
        const revenueGrowth = this.calculateGrowth(monthlyData.sales, currentMonth);
        const expenseRatio = sales > 0 ? ((expenses / sales) * 100).toFixed(1) : 0;

        this.updateElement('profitMargin', `${profitMargin}%`);
        this.updateElement('revenueGrowth', `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}%`);
        this.updateElement('expenseRatio', `${expenseRatio}%`);
    }

    initializeCharts() {
        if (!this.dashboardData) return;

        this.createMonthlyChart();
        this.createTopSellingChart();
        this.createFinancialChart();
        this.createDebtStatusChart();
    }

    createMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;

        const data = this.dashboardData.monthlySummary;
        
        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Sales',
                    data: data.sales,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Purchases',
                    data: data.purchases,
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Expenses',
                    data: data.expenses,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    createTopSellingChart() {
        const ctx = document.getElementById('topSellingChart');
        if (!ctx) return;

        const topSelling = this.dashboardData.topSelling;
        
        this.charts.topSelling = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: topSelling.map(item => item.material__name),
                datasets: [{
                    data: topSelling.map(item => item.total_sold),
                    backgroundColor: ['#3498db', '#27ae60', '#f39c12', '#e74c3c', '#9b59b6']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    createFinancialChart() {
        const ctx = document.getElementById('financialChart');
        if (!ctx) return;

        // Calculate quarterly data from monthly
        const monthly = this.dashboardData.monthlySummary;
        const quarters = this.calculateQuarterlyData(monthly);

        this.charts.financial = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                datasets: [{
                    label: 'Revenue',
                    data: quarters.sales,
                    backgroundColor: '#3498db'
                }, {
                    label: 'Costs',
                    data: quarters.purchases,
                    backgroundColor: '#e74c3c'
                }, {
                    label: 'Profit',
                    data: quarters.profit,
                    backgroundColor: '#27ae60'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    // Utility methods
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    getActivityIcon(module) {
        const icons = {
            'Sale': 'fa-chart-line',
            'Inventory': 'fa-boxes',
            'Supplier': 'fa-truck',
            'Purchase': 'fa-shopping-cart',
            'Report': 'fa-file-alt'
        };
        return icons[module] || 'fa-info';
    }

    getStatusClass(status) {
        const classes = {
            'Good': 'badge-success',
            'Medium': 'badge-info', 
            'Low': 'badge-warning',
            'Critical': 'badge-danger'
        };
        return classes[status] || 'badge-secondary';
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000);

        if (diff < 60) return `${diff} seconds ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        return `${Math.floor(diff / 86400)} days ago`;
    }

    calculateGrowth(data, currentIndex) {
        if (currentIndex === 0) return 0;
        const current = data[currentIndex];
        const previous = data[currentIndex - 1];
        if (previous === 0) return 0;
        return ((current - previous) / previous * 100).toFixed(1);
    }

    calculateQuarterlyData(monthly) {
        const quarters = {
            sales: [0, 0, 0, 0],
            purchases: [0, 0, 0, 0],
            profit: [0, 0, 0, 0]
        };

        for (let i = 0; i < 12; i++) {
            const quarter = Math.floor(i / 3);
            quarters.sales[quarter] += monthly.sales[i];
            quarters.purchases[quarter] += monthly.purchases[i];
            quarters.profit[quarter] += monthly.sales[i] - monthly.purchases[i] - monthly.expenses[i];
        }

        return quarters;
    }

    createDebtStatusChart() {
        const ctx = document.getElementById('debtStatusChart');
        if (!ctx || !this.dashboardData.debtSummary) return;

        const statusData = this.dashboardData.debtSummary.status_distribution;
        const labels = [];
        const data = [];
        const colors = [];

        // Map status to labels and colors
        const statusMap = {
            'pending': { label: 'Pending', color: '#ffc107' },
            'overdue': { label: 'Overdue', color: '#dc3545' },
            'partially_paid': { label: 'Partially Paid', color: '#fd7e14' },
            'paid': { label: 'Paid', color: '#28a745' }
        };

        Object.entries(statusData).forEach(([status, count]) => {
            if (count > 0 && statusMap[status]) {
                labels.push(statusMap[status].label);
                data.push(count);
                colors.push(statusMap[status].color);
            }
        });

        this.charts.debtStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    getDebtStatusClass(status) {
        const classes = {
            'pending': 'bg-warning',
            'overdue': 'bg-danger',
            'partially_paid': 'bg-warning',
            'paid': 'bg-success'
        };
        return classes[status] || 'bg-secondary';
    }

    formatDebtStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'overdue': 'Overdue',
            'partially_paid': 'Partial',
            'paid': 'Paid'
        };
        return statusMap[status] || status;
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    handleResize() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('expanded');
        } else {
            sidebar.classList.remove('collapsed');
            mainContent.classList.remove('expanded');
        }
    }

    setupResponsive() {
        this.handleResize();
    }

    showError(message) {
        console.error(message);
        notificationManager.showError(message);
    }

    showSuccess(message) {
        notificationManager.showSuccess(message);
    }

    showWarning(message) {
        notificationManager.showWarning(message);
    }

    showInfo(message) {
        notificationManager.showInfo(message);
    }

    // Public method to refresh dashboard
    async refresh() {
        await this.loadDashboardData();
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.initializeCharts();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Auto-refresh every 5 minutes
setInterval(() => {
    if (window.dashboard) {
        window.dashboard.refresh();
    }
}, 300000);