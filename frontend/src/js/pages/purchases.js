import apiClient from '../apiClient.js';

class PurchaseManager {
    constructor() {
        this.purchases = [];
        this.suppliers = [];
        this.materials = [];
        this.filteredPurchases = [];
        this.currentPage = 1;
        this.itemsPerPage = 6;
        this.totalPages = 1;
        this.currentEditId = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.renderTable();
        this.populateFilters();
    }

    setupEventListeners() {
        // Search and filter
        document.getElementById('searchInput').addEventListener('input', () => this.filterTable());
        document.getElementById('statusFilter').addEventListener('change', () => this.filterTable());
        document.getElementById('supplierFilter').addEventListener('change', () => this.filterTable());
        
        // Menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
            document.getElementById('mainContent').classList.toggle('expanded');
        });

        // Pagination
        document.getElementById('prevBtn')?.addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextBtn')?.addEventListener('click', () => this.changePage(1));
        
        // Modal events
        document.getElementById('purchaseModal').addEventListener('hidden.bs.modal', () => this.resetForm());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete());
    }

    async loadData() {
        try {
            const [purchasesData, suppliersData, materialsData] = await Promise.all([
                apiClient.get('/purchases/orders/'),
                apiClient.get('/suppliers/suppliers/'),
                apiClient.get('/inventory/materials/')
            ]);
            
            this.purchases = purchasesData.results || purchasesData;
            this.filteredPurchases = [...this.purchases];
            this.suppliers = suppliersData.results || suppliersData;
            this.materials = materialsData.results || materialsData;
            
            this.populateSelects();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Error loading data', 'error');
        }
    }

    populateSelects() {
        const supplierSelect = document.getElementById('supplierSelect');
        const materialSelects = document.querySelectorAll('.material-select');
        
        // Populate suppliers
        supplierSelect.innerHTML = '<option value="">Select Supplier</option>';
        this.suppliers.forEach(supplier => {
            supplierSelect.innerHTML += `<option value="${supplier.id}">${supplier.name}</option>`;
        });

        // Populate materials
        materialSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Material</option>';
            this.materials.forEach(material => {
                select.innerHTML += `<option value="${material.id}">${material.name}</option>`;
            });
        });
    }

    populateFilters() {
        const supplierFilter = document.getElementById('supplierFilter');
        supplierFilter.innerHTML = '<option value="">All Suppliers</option>';
        this.suppliers.forEach(supplier => {
            supplierFilter.innerHTML += `<option value="${supplier.id}">${supplier.name}</option>`;
        });
    }

    renderTable() {
        const tbody = document.getElementById('purchaseTableBody');
        tbody.innerHTML = '';

        if (this.filteredPurchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No purchase orders found</td></tr>';
            this.updatePagination();
            return;
        }

        // Apply pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredPurchases.slice(startIndex, endIndex);

        pageItems.forEach(purchase => {
            const supplier = this.suppliers.find(s => s.id === purchase.supplier);
            const totalAmount = purchase.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const itemCount = purchase.items.length;
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>PO-${String(purchase.id).padStart(4, '0')}</strong></td>
                    <td>${supplier ? supplier.name : 'Unknown'}</td>
                    <td><span class="badge bg-info text-white">${itemCount} item${itemCount !== 1 ? 's' : ''}</span></td>
                    <td><strong>$${totalAmount.toFixed(2)}</strong></td>
                    <td><span class="badge ${this.getStatusClass(purchase.status)}">${purchase.status}</span></td>
                    <td>${new Date(purchase.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="purchaseManager.editPurchase(${purchase.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger me-1" onclick="purchaseManager.deletePurchase(${purchase.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                        ${purchase.status === 'pending' ? 
                            `<button class="btn btn-sm btn-success" onclick="purchaseManager.receivePurchase(${purchase.id})">
                                <i class="fas fa-check"></i>
                            </button>` : ''}
                    </td>
                </tr>
            `;
        });
        this.updatePagination();
    }

    filterTable() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const supplierFilter = document.getElementById('supplierFilter').value;

        this.filteredPurchases = this.purchases.filter(purchase => {
            const supplier = this.suppliers.find(s => s.id === purchase.supplier);
            const supplierName = supplier ? supplier.name.toLowerCase() : '';
            const poNumber = `PO-${String(purchase.id).padStart(4, '0')}`.toLowerCase();
            
            const matchesSearch = poNumber.includes(search) || supplierName.includes(search);
            const matchesStatus = !statusFilter || purchase.status === statusFilter;
            const matchesSupplier = !supplierFilter || purchase.supplier.toString() === supplierFilter;
            
            return matchesSearch && matchesStatus && matchesSupplier;
        });

        this.currentPage = 1; // Reset to first page when filtering
        this.renderTable();
    }

    updatePagination() {
        this.totalPages = Math.ceil(this.filteredPurchases.length / this.itemsPerPage);
        
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const pageInfo = document.getElementById('pageInfo');
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }

    changePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.renderTable();
        }
    }

    getStatusClass(status) {
        const classes = {
            'pending': 'bg-warning',
            'received': 'bg-success',
            'cancelled': 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    }

    editPurchase(id) {
        const purchase = this.purchases.find(p => p.id === id);
        if (!purchase) return;

        this.currentEditId = id;
        document.getElementById('purchaseModalTitle').textContent = 'Edit Purchase Order';
        document.getElementById('supplierSelect').value = purchase.supplier;
        document.getElementById('statusSelect').value = purchase.status;

        // Clear existing items and populate with purchase items
        const container = document.getElementById('itemsContainer');
        container.innerHTML = '';
        
        purchase.items.forEach((item, index) => {
            this.addItemRow(item, index === 0);
        });

        new bootstrap.Modal(document.getElementById('purchaseModal')).show();
    }

    addItemRow(item = null, isFirst = false) {
        const container = document.getElementById('itemsContainer');
        const row = document.createElement('div');
        row.className = 'item-row';
        
        row.innerHTML = `
            <div class="form-group">
                <label class="form-label">Material</label>
                <select class="form-select material-select" required>
                    <option value="">Select Material</option>
                    ${this.materials.map(m => `<option value="${m.id}" ${item && item.material === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="flex: 0 0 120px;">
                <label class="form-label">Quantity</label>
                <input type="number" class="form-control quantity-input" step="0.01" value="${item ? item.quantity : ''}" required>
            </div>
            <div class="form-group" style="flex: 0 0 120px;">
                <label class="form-label">Price</label>
                <input type="number" class="form-control price-input" step="0.01" value="${item ? item.price : ''}" required>
            </div>
            <button type="button" class="remove-item" onclick="removeItem(this)" ${isFirst ? 'style="display: none;"' : ''}>
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        container.appendChild(row);
    }

    async savePurchaseOrder() {
        const form = document.getElementById('purchaseForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = this.getFormData();
        if (!formData) return;

        try {
            if (this.currentEditId) {
                await apiClient.put(`/purchases/orders/${this.currentEditId}/`, formData);
                this.showToast('Purchase order updated successfully', 'success');
            } else {
                await apiClient.post('/purchases/orders/', formData);
                this.showToast('Purchase order created successfully', 'success');
            }
            
            await this.loadData();
            this.renderTable();
            bootstrap.Modal.getInstance(document.getElementById('purchaseModal')).hide();
        } catch (error) {
            console.error('Error saving purchase order:', error);
            this.showToast('Error saving purchase order', 'error');
        }
    }

    getFormData() {
        const supplier = document.getElementById('supplierSelect').value;
        const status = document.getElementById('statusSelect').value;
        const items = [];

        const itemRows = document.querySelectorAll('.item-row');
        for (const row of itemRows) {
            const material = row.querySelector('.material-select').value;
            const quantity = row.querySelector('.quantity-input').value;
            const price = row.querySelector('.price-input').value;

            if (!material || !quantity || !price) {
                this.showToast('Please fill all item fields', 'error');
                return null;
            }

            items.push({
                material: parseInt(material),
                quantity: parseFloat(quantity),
                price: parseFloat(price)
            });
        }

        if (items.length === 0) {
            this.showToast('Please add at least one item', 'error');
            return null;
        }

        return {
            supplier: parseInt(supplier),
            status,
            items
        };
    }

    deletePurchase(id) {
        this.currentEditId = id;
        new bootstrap.Modal(document.getElementById('deleteModal')).show();
    }

    async confirmDelete() {
        if (!this.currentEditId) return;

        try {
            await apiClient.delete(`/purchases/orders/${this.currentEditId}/`);
            this.showToast('Purchase order deleted successfully', 'success');
            await this.loadData();
            this.renderTable();
            bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
        } catch (error) {
            console.error('Error deleting purchase order:', error);
            this.showToast('Error deleting purchase order', 'error');
        }
    }

    async receivePurchase(id) {
        try {
            await apiClient.post(`/purchases/orders/${id}/receive/`);
            this.showToast('Purchase order received successfully', 'success');
            await this.loadData();
            this.renderTable();
        } catch (error) {
            console.error('Error receiving purchase order:', error);
            this.showToast('Error receiving purchase order', 'error');
        }
    }

    resetForm() {
        this.currentEditId = null;
        document.getElementById('purchaseModalTitle').textContent = 'Create Purchase Order';
        document.getElementById('purchaseForm').reset();
        
        const container = document.getElementById('itemsContainer');
        container.innerHTML = '';
        this.addItemRow(null, true);
    }

    showToast(message, type) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        const toast = document.createElement('div');
        toast.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
}

// Global functions
window.addItem = () => purchaseManager.addItemRow();
window.removeItem = (button) => {
    const row = button.closest('.item-row');
    if (document.querySelectorAll('.item-row').length > 1) {
        row.remove();
    }
};
window.savePurchaseOrder = () => purchaseManager.savePurchaseOrder();

// Initialize
const purchaseManager = new PurchaseManager();
window.purchaseManager = purchaseManager;