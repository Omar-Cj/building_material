// sales.js
import apiClient from '../apiClient.js';

class SalesManager {
    constructor() {
        this.sales = [];
        this.customers = [];
        this.materials = [];
        this.filteredSales = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.renderSalesTable();
    }

    setupEventListeners() {
        // Menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
            document.getElementById('mainContent').classList.toggle('expanded');
        });

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        });

        // Search functionality
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.searchSales(e.target.value);
        });

        // Filter functionality
        document.getElementById('customerFilter')?.addEventListener('change', () => {
            this.filterSales();
        });

        document.getElementById('paymentFilter')?.addEventListener('change', () => {
            this.filterSales();
        });

        // New sale button
        document.getElementById('newSaleBtn')?.addEventListener('click', () => {
            this.showSaleModal();
        });
    }

    async loadInitialData() {
        try {
            const [salesData, customersData, materialsData] = await Promise.all([
                apiClient.get('/sales/orders/'),
                apiClient.get('/customers/customers/'),
                apiClient.get('/inventory/materials/')
            ]);

            this.sales = salesData.results || salesData;
            this.filteredSales = [...this.sales];
            this.customers = customersData.results || customersData;
            this.materials = materialsData.results || materialsData;

            this.renderUI();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showAlert('Error loading data', 'danger');
        }
    }

    renderUI() {
        const mainContent = document.getElementById('mainContent');
        const existingContent = mainContent.querySelector('.content-area');
        
        if (existingContent) {
            existingContent.remove();
        }

        const contentHTML = `
            <div class="content-area">
                <!-- Stats Cards -->
                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-primary">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="stat-content">
                                <h3 id="totalSales">${this.sales.length}</h3>
                                <p>Total Sales</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-success">
                                <i class="fas fa-dollar-sign"></i>
                            </div>
                            <div class="stat-content">
                                <h3 id="totalRevenue">$${this.calculateTotalRevenue()}</h3>
                                <p>Total Revenue</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-info">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                            <div class="stat-content">
                                <h3 id="todaySales">${this.getTodaySalesCount()}</h3>
                                <p>Today's Sales</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-warning">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-content">
                                <h3 id="activeCustomers">${this.customers.length}</h3>
                                <p>Active Customers</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Controls -->
                <div class="chart-container">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h4 class="mb-0">Sales Management</h4>
                        <button class="btn btn-primary" id="newSaleBtn">
                            <i class="fas fa-plus"></i> New Sale
                        </button>
                    </div>

                    <!-- Search and Filters -->
                    <div class="search-filter-section">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="searchInput" placeholder="Search sales...">
                        </div>
                        <select class="form-select" id="customerFilter" style="width: 200px;">
                            <option value="">All Customers</option>
                            ${this.customers.map(customer => `<option value="${customer.id}">${customer.name}</option>`).join('')}
                        </select>
                        <select class="form-select" id="paymentFilter" style="width: 180px;">
                            <option value="">All Payment Methods</option>
                            <option value="cash">Cash</option>
                            <option value="zaad">Zaad</option>
                            <option value="edahab">Edahab</option>
                        </select>
                    </div>

                    <!-- Sales Table -->
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Sale ID</th>
                                    <th>Customer</th>
                                    <th>Date</th>
                                    <th>Items</th>
                                    <th>Total Amount</th>
                                    <th>Payment Method</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="salesTableBody">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        mainContent.insertAdjacentHTML('beforeend', contentHTML);
        
        // Set up event listeners after the UI is rendered
        this.setupEventListenersAfterRender();
    }

    setupEventListenersAfterRender() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchSales(e.target.value);
            });
        }

        // Filter functionality
        const customerFilter = document.getElementById('customerFilter');
        if (customerFilter) {
            customerFilter.addEventListener('change', () => {
                this.filterSales();
            });
        }

        const paymentFilter = document.getElementById('paymentFilter');
        if (paymentFilter) {
            paymentFilter.addEventListener('change', () => {
                this.filterSales();
            });
        }

        // New sale button
        const newSaleBtn = document.getElementById('newSaleBtn');
        if (newSaleBtn) {
            newSaleBtn.addEventListener('click', () => {
                this.showSaleModal();
            });
        }
    }

    renderSalesTable() {
        const tbody = document.getElementById('salesTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.filteredSales.forEach(sale => {
            const row = document.createElement('tr');
            const customer = this.customers.find(c => c.id === sale.customer);
            const itemCount = sale.items ? sale.items.length : 0;

            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="purchase-avatar">
                            <i class="fas fa-receipt"></i>
                        </div>
                        <div class="ms-3">
                            <strong>#${sale.id}</strong>
                        </div>
                    </div>
                </td>
                <td>${customer ? customer.name : 'Unknown'}</td>
                <td>${new Date(sale.sale_date).toLocaleDateString()}</td>
                <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
                <td><strong>$${parseFloat(sale.total_amount).toFixed(2)}</strong></td>
                <td>
                    <span class="badge ${this.getPaymentMethodClass(sale.payment_method)}">
                        ${sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-warning btn-sm me-2" onclick="salesManager.editSale(${sale.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-info btn-sm me-2" onclick="salesManager.viewSale(${sale.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="salesManager.deleteSale(${sale.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        this.updateStats();
    }

    updateStats() {
        const totalSalesEl = document.getElementById('totalSales');
        const totalRevenueEl = document.getElementById('totalRevenue');
        
        if (totalSalesEl) totalSalesEl.textContent = this.filteredSales.length;
        if (totalRevenueEl) {
            const revenue = this.filteredSales.reduce((total, sale) => total + parseFloat(sale.total_amount), 0).toFixed(2);
            totalRevenueEl.textContent = `$${revenue}`;
        }
    }

    getPaymentMethodClass(method) {
        const classes = {
            'cash': 'bg-success',
            'zaad': 'bg-primary',
            'edahab': 'bg-info'
        };
        return classes[method] || 'bg-secondary';
    }

    calculateTotalRevenue() {
        return this.sales.reduce((total, sale) => total + parseFloat(sale.total_amount), 0).toFixed(2);
    }

    getTodaySalesCount() {
        const today = new Date().toDateString();
        return this.sales.filter(sale => new Date(sale.sale_date).toDateString() === today).length;
    }

    showSaleModal(sale = null) {
        const isEdit = !!sale;
        const modalHTML = `
            <div class="modal fade" id="saleModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${isEdit ? 'Edit Sale' : 'New Sale'}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="saleForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label required">Customer</label>
                                            <select class="form-control" id="saleCustomer" required>
                                                <option value="">Select Customer</option>
                                                ${this.customers.map(c => `<option value="${c.id}" ${sale && sale.customer === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label required">Payment Method</label>
                                            <select class="form-control" id="salePaymentMethod" required>
                                                <option value="cash" ${sale && sale.payment_method === 'cash' ? 'selected' : ''}>Cash</option>
                                                <option value="zaad" ${sale && sale.payment_method === 'zaad' ? 'selected' : ''}>Zaad</option>
                                                <option value="edahab" ${sale && sale.payment_method === 'edahab' ? 'selected' : ''}>Check</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="items-container">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <h6>Sale Items</h6>
                                        <button type="button" class="btn btn-success btn-sm" id="addItemBtn">
                                            <i class="fas fa-plus"></i> Add Item
                                        </button>
                                    </div>
                                    <div id="itemsContainer">
                                        ${sale && sale.items ? sale.items.map((item, index) => this.createItemRow(item, index)).join('') : this.createItemRow()}
                                    </div>
                                </div>

                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label class="form-label">Tax</label>
                                            <input type="number" class="form-control" id="saleTax" step="0.01" min="0" value="${sale ? sale.tax : '0'}" onchange="salesManager.calculateTotal()">
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label class="form-label">Discount</label>
                                            <input type="number" class="form-control" id="saleDiscount" step="0.01" min="0" value="${sale ? sale.discount : '0'}" onchange="salesManager.calculateTotal()">
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label class="form-label">Total Amount</label>
                                            <input type="number" class="form-control" id="saleTotalAmount" readonly value="${sale ? sale.total_amount : '0'}">
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="saveSaleBtn">${isEdit ? 'Update' : 'Create'} Sale</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('saleModal'));
        modal.show();

        // Setup modal event listeners
        document.getElementById('addItemBtn').addEventListener('click', () => this.addItemRow());
        document.getElementById('saveSaleBtn').addEventListener('click', () => this.saveSale(isEdit ? sale.id : null));
        
        document.getElementById('saleModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('saleModal').remove();
        });

        this.calculateTotal();
    }

    createItemRow(item = null, index = 0) {
        return `
            <div class="item-row">
                <div class="form-group">
                    <label class="form-label">Material</label>
                    <select class="form-control item-material" required onchange="salesManager.updateItemPrice(this)">
                        <option value="">Select Material</option>
                        ${this.materials.map(m => `<option value="${m.id}" data-price="${m.price_per_unit}" ${item && item.material === m.id ? 'selected' : ''}>${m.name} (Stock: ${m.quantity_in_stock})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Quantity</label>
                    <input type="number" class="form-control item-quantity" step="0.01" min="0.01" value="${item ? item.quantity : '1'}" required onchange="salesManager.calculateTotal()">
                </div>
                <div class="form-group">
                    <label class="form-label">Price</label>
                    <input type="number" class="form-control item-price" step="0.01" min="0" value="${item ? item.price : '0'}" required onchange="salesManager.calculateTotal()">
                </div>
                <button type="button" class="remove-item" onclick="this.parentElement.remove(); salesManager.calculateTotal();">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    addItemRow() {
        const container = document.getElementById('itemsContainer');
        container.insertAdjacentHTML('beforeend', this.createItemRow());
    }

    updateItemPrice(selectElement) {
        const row = selectElement.closest('.item-row');
        const priceInput = row.querySelector('.item-price');
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        
        if (selectedOption.dataset.price) {
            priceInput.value = selectedOption.dataset.price;
            this.calculateTotal();
        }
    }

    calculateTotal() {
        const itemRows = document.querySelectorAll('.item-row');
        let subtotal = 0;

        itemRows.forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            subtotal += quantity * price;
        });

        const tax = parseFloat(document.getElementById('saleTax')?.value) || 0;
        const discount = parseFloat(document.getElementById('saleDiscount')?.value) || 0;
        const total = subtotal + tax - discount;

        const totalInput = document.getElementById('saleTotalAmount');
        if (totalInput) {
            totalInput.value = total.toFixed(2);
        }
    }

    async saveSale(saleId = null) {
        const formData = this.collectSaleFormData();
        if (!formData) return;

        try {
            if (saleId) {
                await apiClient.put(`/sales/orders/${saleId}/`, formData);
                this.showAlert('Sale updated successfully', 'success');
            } else {
                await apiClient.post('/sales/orders/', formData);
                this.showAlert('Sale created successfully', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('saleModal')).hide();
            await this.loadInitialData();
            this.renderSalesTable();
        } catch (error) {
            console.error('Error saving sale:', error);
            this.showAlert(error.message || 'Error saving sale', 'danger');
        }
    }

    collectSaleFormData() {
        const customer = document.getElementById('saleCustomer').value;
        const paymentMethod = document.getElementById('salePaymentMethod').value;
        const tax = parseFloat(document.getElementById('saleTax').value) || 0;
        const discount = parseFloat(document.getElementById('saleDiscount').value) || 0;

        const items = [];
        document.querySelectorAll('.item-row').forEach(row => {
            const material = row.querySelector('.item-material').value;
            const quantity = parseFloat(row.querySelector('.item-quantity').value);
            const price = parseFloat(row.querySelector('.item-price').value);

            if (material && quantity > 0 && price >= 0) {
                items.push({ material: parseInt(material), quantity, price });
            }
        });

        if (!customer || !paymentMethod || items.length === 0) {
            this.showAlert('Please fill all required fields and add at least one item', 'warning');
            return null;
        }

        return { customer: parseInt(customer), payment_method: paymentMethod, tax, discount, items };
    }

    editSale(saleId) {
        const sale = this.sales.find(s => s.id === saleId);
        if (sale) {
            this.showSaleModal(sale);
        }
    }

    viewSale(saleId) {
        const sale = this.sales.find(s => s.id === saleId);
        if (!sale) return;

        const customer = this.customers.find(c => c.id === sale.customer);
        const modalHTML = `
            <div class="modal fade" id="viewSaleModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Sale Details #${sale.id}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-6"><strong>Customer:</strong> ${customer ? customer.name : 'Unknown'}</div>
                                <div class="col-md-6"><strong>Date:</strong> ${new Date(sale.sale_date).toLocaleString()}</div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-md-6"><strong>Payment Method:</strong> ${sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1)}</div>
                                <div class="col-md-6"><strong>Total Amount:</strong> $${parseFloat(sale.total_amount).toFixed(2)}</div>
                            </div>
                            <h6>Items:</h6>
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr><th>Material</th><th>Quantity</th><th>Price</th><th>Total</th></tr>
                                    </thead>
                                    <tbody>
                                        ${sale.items ? sale.items.map(item => {
                                            const material = this.materials.find(m => m.id === item.material);
                                            return `<tr>
                                                <td>${material ? material.name : 'Unknown'}</td>
                                                <td>${item.quantity}</td>
                                                <td>$${parseFloat(item.price).toFixed(2)}</td>
                                                <td>$${(item.quantity * item.price).toFixed(2)}</td>
                                            </tr>`;
                                        }).join('') : '<tr><td colspan="4">No items</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                            ${sale.tax > 0 ? `<p><strong>Tax:</strong> $${parseFloat(sale.tax).toFixed(2)}</p>` : ''}
                            ${sale.discount > 0 ? `<p><strong>Discount:</strong> $${parseFloat(sale.discount).toFixed(2)}</p>` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('viewSaleModal'));
        modal.show();

        document.getElementById('viewSaleModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('viewSaleModal').remove();
        });
    }

    deleteSale(saleId) {
        const sale = this.sales.find(s => s.id === saleId);
        if (!sale) return;

        const confirmHTML = `
            <div class="modal fade" id="confirmDeleteModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Confirm Deletion</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Are you sure you want to delete sale #${sale.id}?</p>
                            <p class="text-muted">This action cannot be undone.</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', confirmHTML);
        const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        modal.show();

        document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
            try {
                await apiClient.delete(`/sales/orders/${saleId}/`);
                this.showAlert('Sale deleted successfully', 'success');
                modal.hide();
                await this.loadInitialData();
                this.renderSalesTable();
            } catch (error) {
                console.error('Error deleting sale:', error);
                this.showAlert('Error deleting sale', 'danger');
            }
        });

        document.getElementById('confirmDeleteModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('confirmDeleteModal').remove();
        });
    }

    searchSales(query) {
        this.applyFilters();
    }

    filterSales() {
        this.applyFilters();
    }

    applyFilters() {
        const searchQuery = document.getElementById('searchInput')?.value || '';
        const customerFilter = document.getElementById('customerFilter')?.value;
        const paymentFilter = document.getElementById('paymentFilter')?.value;
        
        let filtered = [...this.sales];
        
        // Apply search filter
        if (searchQuery.trim()) {
            const searchTerm = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(sale => {
                const customer = this.customers.find(c => c.id === sale.customer);
                const customerName = (customer?.name || '').toLowerCase();
                const saleId = sale.id.toString();
                const paymentMethod = sale.payment_method.toLowerCase();
                
                return saleId.includes(searchTerm) || 
                       customerName.includes(searchTerm) || 
                       paymentMethod.includes(searchTerm);
            });
        }
        
        // Apply customer filter
        if (customerFilter) {
            filtered = filtered.filter(sale => sale.customer.toString() === customerFilter);
        }
        
        // Apply payment method filter
        if (paymentFilter) {
            filtered = filtered.filter(sale => sale.payment_method === paymentFilter);
        }
        
        this.filteredSales = filtered;
        this.renderSalesTable();
    }

    showAlert(message, type) {
        const alertHTML = `
            <div class="alert alert-${type} alert-dismissible fade show position-fixed" style="top: 20px; right: 20px; z-index: 9999;">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', alertHTML);
        
        setTimeout(() => {
            const alert = document.querySelector('.alert');
            if (alert) alert.remove();
        }, 5000);
    }
}

// Add required CSS for stat cards
const additionalCSS = `
    .stat-card {
        background: rgba(255, 255, 255, 0.95);
        border-radius: 20px;
        padding: 25px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        gap: 20px;
        transition: transform 0.3s ease;
    }
    
    .stat-card:hover {
        transform: translateY(-5px);
    }
    
    .stat-icon {
        width: 60px;
        height: 60px;
        border-radius: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        color: white;
    }
    
    .stat-content h3 {
        font-size: 2rem;
        font-weight: 700;
        margin: 0;
        color: #2c3e50;
    }
    
    .stat-content p {
        margin: 0;
        color: #7f8c8d;
        font-weight: 500;
    }
`;

// Inject additional CSS
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// Initialize the sales manager
const salesManager = new SalesManager();
window.salesManager = salesManager;