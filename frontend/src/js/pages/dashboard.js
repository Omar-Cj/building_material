// dashboard.js - Optimized Dashboard Logic
import apiClient from '../apiClient.js';

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
            const [inventoryValue, topSelling, activities, monthlySummary] = await Promise.all([
                this.getInventoryValue(),
                this.getTopSellingMaterials(),
                this.getRecentActivities(),
                this.getMonthlySummary()
            ]);

            // Update UI with fetched data
            this.updateStatCards(inventoryValue, monthlySummary);
            this.updateQuickStats();
            this.updateRecentActivities(activities);
            this.updateInventoryTable();
            this.updateFinancialMetrics(monthlySummary);
            
            // Store data for charts
            this.dashboardData = {
                monthlySummary,
                topSelling,
                inventoryValue
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

    updateStatCards(inventoryData, monthlyData) {
        const currentMonth = new Date().getMonth();
        
        // Update main stat cards
        this.updateElement('totalInventoryValue', this.formatCurrency(inventoryData.total_inventory_value));
        this.updateElement('monthlySales', this.formatCurrency(monthlyData.sales[currentMonth]));
        this.updateElement('monthlyPurchases', this.formatCurrency(monthlyData.purchases[currentMonth]));
        this.updateElement('monthlyExpenses', this.formatCurrency(monthlyData.expenses[currentMonth]));
    }

    async updateQuickStats() {
        try {
            // These would need additional API endpoints or can use sample data
            const stats = {
                totalCustomers: 156,
                totalSuppliers: 42,
                totalMaterials: 89,
                lowStockItems: 12
            };

            Object.entries(stats).forEach(([key, value]) => {
                this.updateElement(key, value);
            });
        } catch (error) {
            console.error('Error updating quick stats:', error);
        }
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

    updateInventoryTable() {
        // Sample inventory data - would come from API in real implementation
        const inventoryData = [
            { material: 'Cement', stock: 150, status: 'Good', value: 15000 },
            { material: 'Steel Bars', stock: 25, status: 'Low', value: 12500 },
            { material: 'Bricks', stock: 500, status: 'Good', value: 8000 },
            { material: 'Sand', stock: 8, status: 'Critical', value: 2400 },
            { material: 'Gravel', stock: 75, status: 'Good', value: 3750 }
        ];

        const table = document.getElementById('inventoryStatusTable');
        if (!table) return;

        table.innerHTML = '';
        inventoryData.forEach(item => {
            const row = document.createElement('tr');
            const statusClass = this.getStatusClass(item.status);
            row.innerHTML = `
                <td>${item.material}</td>
                <td>${item.stock} units</td>
                <td><span class="badge ${statusClass}">${item.status}</span></td>
                <td>${this.formatCurrency(item.value)}</td>
            `;
            table.appendChild(row);
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
        // Could implement toast notifications here
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