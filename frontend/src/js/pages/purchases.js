import apiClient from '../apiClient.js';
import notificationManager from '../utils/notifications.js';

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
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="purchase-avatar">
                                <i class="fas fa-shopping-cart"></i>
                            </div>
                            <div class="ms-3">
                                <h6 class="mb-0">PO-${String(purchase.id).padStart(4, '0')}</h6>
                                <small class="text-muted">${supplier ? supplier.name : 'Unknown Supplier'}</small>
                            </div>
                        </div>
                    </td>
                    <td>${supplier ? supplier.name : 'Unknown'}</td>
                    <td><span class="badge bg-info text-white">${itemCount} item${itemCount !== 1 ? 's' : ''}</span></td>
                    <td><strong>$${totalAmount.toFixed(2)}</strong></td>
                    <td><span class="badge ${this.getStatusClass(purchase.status)}">${purchase.status}</span></td>
                    <td>${new Date(purchase.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-warning" onclick="purchaseManager.editPurchase(${purchase.id})" title="Edit Purchase">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="purchaseManager.deletePurchase(${purchase.id})" title="Delete Purchase">
                                <i class="fas fa-trash"></i>
                            </button>
                            ${purchase.status === 'pending' ? 
                                `<button class="btn btn-sm btn-success" onclick="purchaseManager.receivePurchase(${purchase.id})" title="Mark as Received">
                                    <i class="fas fa-check"></i>
                                </button>` : ''}
                        </div>
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
        // Map types to notification system
        const typeMap = {
            'success': 'success',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        notificationManager.showNotification(message, typeMap[type] || 'info');
    }

    showSuccess(message) {
        notificationManager.showSuccess(message);
    }

    showError(message) {
        notificationManager.showError(message);
    }

    showWarning(message) {
        notificationManager.showWarning(message);
    }

    showInfo(message) {
        notificationManager.showInfo(message);
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