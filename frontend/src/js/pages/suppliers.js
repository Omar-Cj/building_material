// src/js/pages/suppliers.js
import apiClient from '../apiClient.js';

class SuppliersManager {
    constructor() {
        this.suppliers = [];
        this.currentSupplier = null;
        this.isEditing = false;
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalSuppliers = 0;
        this.searchQuery = '';
        this.filterActive = 'all';
        this.isSubmitting = false; // Prevent duplicate submissions

        this.init();
    }

    async init() {
        try {
            this.initializeTable();
            this.setupEventListeners();
            await this.loadSuppliers();
        } catch (error) {
            console.error('Failed to initialize suppliers manager:', error);
            this.showNotification('Failed to initialize suppliers module', 'error');
        }
    }

    initializeTable() {
        const tableContainer = document.getElementById('suppliersTableContainer');
        if (!tableContainer) {
            console.error('Suppliers table container not found');
            return;
        }

        tableContainer.innerHTML = `
            <div class="row mb-3">
                <div class="col-md-6">
                    <div class="input-group">
                        <span class="input-group-text"><i class="fas fa-search"></i></span>
                        <input type="text" class="form-control" id="searchSuppliers" placeholder="Search suppliers...">
                    </div>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="filterActive">
                        <option value="all">All Suppliers</option>
                        <option value="true">Active Only</option>
                        <option value="false">Inactive Only</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <button class="btn btn-outline-primary" id="refreshSuppliers">
                        <i class="fas fa-refresh"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover" id="suppliersTable">
                    <thead class="table-dark">
                        <tr>
                            <th>Name</th>
                            <th>Contact Person</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>City</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="suppliersTableBody"></tbody>
                </table>
            </div>
            
            <nav aria-label="Suppliers pagination" id="suppliersPagination"></nav>
        `;
    }

    setupEventListeners() {
        // Form submission - prevent duplicate submissions
        const supplierForm = document.getElementById('supplierForm');
        if (supplierForm) {
            supplierForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Modal reset
        const supplierModal = document.getElementById('supplierModal');
        if (supplierModal) {
            supplierModal.addEventListener('hidden.bs.modal', () => this.resetForm());
        }

        // Add supplier button
        const addSupplierBtn = document.querySelector('[data-bs-target="#supplierModal"]');
        if (addSupplierBtn) {
            addSupplierBtn.addEventListener('click', () => this.openModal());
        }

        // Search with debounce
        const searchInput = document.getElementById('searchSuppliers');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.currentPage = 1;
                    this.loadSuppliers();
                }, 300);
            });
        }

        // Filter
        const filterSelect = document.getElementById('filterActive');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterActive = e.target.value;
                this.currentPage = 1;
                this.loadSuppliers();
            });
        }

        // Refresh
        const refreshBtn = document.getElementById('refreshSuppliers');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadSuppliers());
        }
    }

    async loadSuppliers() {
        try {
            this.showLoading(true);

            // Build endpoint with proper query parameters
            const params = new URLSearchParams({
                page: this.currentPage,
                page_size: this.pageSize
            });

            if (this.searchQuery) {
                params.append('search', this.searchQuery);
            }

            if (this.filterActive !== 'all') {
                params.append('is_active', this.filterActive);
            }

            // Fixed endpoint - ensure correct API path
            const response = await apiClient.get(`/suppliers/suppliers/?${params.toString()}`);
            
            // Handle different response structures
            if (response.results) {
                this.suppliers = response.results;
                this.totalSuppliers = response.count || 0;
            } else if (Array.isArray(response)) {
                this.suppliers = response;
                this.totalSuppliers = response.length;
            } else {
                this.suppliers = [];
                this.totalSuppliers = 0;
            }

            this.renderTable();
            this.updatePagination();

        } catch (error) {
            console.error('Failed to load suppliers:', error);
            this.showNotification(`Failed to load suppliers: ${error.message}`, 'error');
            this.suppliers = [];
            this.renderTable();
        } finally {
            this.showLoading(false);
        }
    }

    renderTable() {
        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;

        if (this.suppliers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted">No suppliers found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.suppliers.map(supplier => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="supplier-avatar me-2">
                            <i class="fas fa-truck"></i>
                        </div>
                        <div>
                            <strong>${this.escapeHtml(supplier.name)}</strong>
                            ${supplier.website ? `<br><small class="text-muted">${this.escapeHtml(supplier.website)}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td>${this.escapeHtml(supplier.contact_person || '-')}</td>
                <td>${supplier.email ? `<a href="mailto:${supplier.email}">${this.escapeHtml(supplier.email)}</a>` : '-'}</td>
                <td>${supplier.phone ? `<a href="tel:${supplier.phone}">${this.escapeHtml(supplier.phone)}</a>` : '-'}</td>
                <td>${this.escapeHtml(supplier.city || '-')}</td>
                <td>
                    <span class="badge ${supplier.is_active ? 'bg-success' : 'bg-danger'}">
                        ${supplier.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="suppliersManager.viewSupplier(${supplier.id})" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="suppliersManager.editSupplier(${supplier.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="suppliersManager.deleteSupplier(${supplier.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updatePagination() {
        const paginationContainer = document.getElementById('suppliersPagination');
        if (!paginationContainer) return;

        const totalPages = Math.ceil(this.totalSuppliers / this.pageSize);

        if (totalPages <= 1) {
            paginationContainer.innerHTML = `
                <div class="d-flex justify-content-center mt-3">
                    <small class="text-muted">Showing ${this.totalSuppliers} suppliers</small>
                </div>
            `;
            return;
        }

        let paginationHTML = '<ul class="pagination justify-content-center">';

        // Previous button
        paginationHTML += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="suppliersManager.changePage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
            </li>
        `;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <button class="page-link" onclick="suppliersManager.changePage(${i})">${i}</button>
                </li>
            `;
        }

        // Next button
        paginationHTML += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link" onclick="suppliersManager.changePage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </li>
        `;

        paginationHTML += '</ul>';

        // Add pagination info
        paginationHTML += `
            <div class="d-flex justify-content-center mt-2">
                <small class="text-muted">
                    Showing ${(this.currentPage - 1) * this.pageSize + 1} to 
                    ${Math.min(this.currentPage * this.pageSize, this.totalSuppliers)} of 
                    ${this.totalSuppliers} suppliers
                </small>
            </div>
        `;

        paginationContainer.innerHTML = paginationHTML;
    }

    changePage(page) {
        const totalPages = Math.ceil(this.totalSuppliers / this.pageSize);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.loadSuppliers();
    }

    openModal(supplier = null) {
        this.currentSupplier = supplier;
        this.isEditing = !!supplier;

        const modal = new bootstrap.Modal(document.getElementById('supplierModal'));
        const modalTitle = document.getElementById('supplierModalLabel');

        if (modalTitle) {
            modalTitle.innerHTML = `
                <i class="fas fa-truck me-2"></i>
                ${this.isEditing ? 'Edit Supplier' : 'Add New Supplier'}
            `;
        }

        if (this.isEditing && supplier) {
            this.populateForm(supplier);
        }

        modal.show();
    }

    populateForm(supplier) {
        const form = document.getElementById('supplierForm');
        if (!form) return;

        const fields = [
            'name', 'contact_person', 'email', 'phone', 'alternative_phone',
            'address', 'city', 'state', 'postal_code', 'country', 'website',
            'tax_id', 'payment_terms', 'credit_limit', 'notes'
        ];

        fields.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.value = supplier[field] || '';
            }
        });

        const isActiveCheckbox = form.querySelector('[name="is_active"]');
        if (isActiveCheckbox) {
            isActiveCheckbox.checked = supplier.is_active !== false;
        }
    }

    resetForm() {
        const form = document.getElementById('supplierForm');
        if (form) {
            form.reset();
            form.classList.remove('was-validated');
        }
        this.currentSupplier = null;
        this.isEditing = false;
        this.isSubmitting = false;
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        e.stopPropagation();

        // Prevent duplicate submissions
        if (this.isSubmitting) {
            console.log('Form submission already in progress');
            return;
        }

        const form = e.target;
        
        // Validate form
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        this.isSubmitting = true;

        try {
            const formData = new FormData(form);
            const supplierData = this.buildSupplierData(formData, form);

            let response;
            if (this.isEditing && this.currentSupplier) {
                response = await apiClient.put(`/suppliers/suppliers/${this.currentSupplier.id}/`, supplierData);
                this.showNotification('Supplier updated successfully', 'success');
            } else {
                response = await apiClient.post('/suppliers/suppliers/', supplierData);
                this.showNotification('Supplier created successfully', 'success');
            }

            // Close modal and reload data
            const modal = bootstrap.Modal.getInstance(document.getElementById('supplierModal'));
            if (modal) {
                modal.hide();
            }

            await this.loadSuppliers();

        } catch (error) {
            console.error('Failed to save supplier:', error);
            this.showNotification(`Failed to ${this.isEditing ? 'update' : 'create'} supplier: ${error.message}`, 'error');
        } finally {
            this.isSubmitting = false;
        }
    }

    buildSupplierData(formData, form) {
        const supplierData = {};

        // Convert FormData to object with proper type handling
        for (let [key, value] of formData.entries()) {
            if (key === 'is_active') {
                supplierData[key] = form.querySelector('[name="is_active"]').checked;
            } else if (key === 'credit_limit') {
                supplierData[key] = value ? parseFloat(value) : 0;
            } else {
                supplierData[key] = value.trim() || null;
            }
        }

        // Ensure is_active is set even if checkbox is unchecked
        if (!supplierData.hasOwnProperty('is_active')) {
            supplierData.is_active = false;
        }

        return supplierData;
    }

    async viewSupplier(id) {
        try {
            const supplier = await apiClient.get(`/suppliers/suppliers/${id}/`);
            this.showSupplierDetails(supplier);
        } catch (error) {
            console.error('Failed to load supplier details:', error);
            this.showNotification('Failed to load supplier details', 'error');
        }
    }

    showSupplierDetails(supplier) {
        const modalHTML = `
            <div class="modal fade" id="supplierDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-truck me-2"></i>
                                ${this.escapeHtml(supplier.name)}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="fw-bold mb-3">Contact Information</h6>
                                    <dl class="row">
                                        <dt class="col-sm-5">Contact Person:</dt>
                                        <dd class="col-sm-7">${this.escapeHtml(supplier.contact_person || '-')}</dd>
                                        <dt class="col-sm-5">Email:</dt>
                                        <dd class="col-sm-7">${supplier.email ? `<a href="mailto:${supplier.email}">${this.escapeHtml(supplier.email)}</a>` : '-'}</dd>
                                        <dt class="col-sm-5">Phone:</dt>
                                        <dd class="col-sm-7">${supplier.phone ? `<a href="tel:${supplier.phone}">${this.escapeHtml(supplier.phone)}</a>` : '-'}</dd>
                                        <dt class="col-sm-5">Website:</dt>
                                        <dd class="col-sm-7">${supplier.website ? `<a href="${supplier.website}" target="_blank">${this.escapeHtml(supplier.website)}</a>` : '-'}</dd>
                                    </dl>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="fw-bold mb-3">Address & Business</h6>
                                    <address class="mb-3">
                                        ${this.escapeHtml(supplier.address || '')}<br>
                                        ${this.escapeHtml(supplier.city || '')}, ${this.escapeHtml(supplier.state || '')}<br>
                                        ${this.escapeHtml(supplier.postal_code || '')} ${this.escapeHtml(supplier.country || '')}
                                    </address>
                                    <dl class="row">
                                        <dt class="col-sm-5">Payment Terms:</dt>
                                        <dd class="col-sm-7">${this.escapeHtml(supplier.payment_terms || '-')}</dd>
                                        <dt class="col-sm-5">Credit Limit:</dt>
                                        <dd class="col-sm-7">$${supplier.credit_limit ? parseFloat(supplier.credit_limit).toLocaleString() : '0'}</dd>
                                        <dt class="col-sm-5">Status:</dt>
                                        <dd class="col-sm-7">
                                            <span class="badge ${supplier.is_active ? 'bg-success' : 'bg-danger'}">
                                                ${supplier.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                            ${supplier.notes ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <h6 class="fw-bold">Notes</h6>
                                        <p class="text-muted">${this.escapeHtml(supplier.notes)}</p>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-warning" onclick="suppliersManager.editSupplier(${supplier.id}); bootstrap.Modal.getInstance(document.getElementById('supplierDetailsModal')).hide();">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('supplierDetailsModal');
        if (existingModal) existingModal.remove();

        // Add and show new modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('supplierDetailsModal'));
        modal.show();

        // Clean up
        document.getElementById('supplierDetailsModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async editSupplier(id) {
        try {
            const supplier = await apiClient.get(`/suppliers/suppliers/${id}/`);
            this.openModal(supplier);
        } catch (error) {
            console.error('Failed to load supplier for editing:', error);
            this.showNotification('Failed to load supplier data', 'error');
        }
    }

    async deleteSupplier(id) {
        const supplier = this.suppliers.find(s => s.id === id);
        if (!supplier) return;

        const confirmed = await this.showConfirmDialog(
            'Delete Supplier',
            `Are you sure you want to delete supplier "${supplier.name}"? This action cannot be undone.`,
            'danger'
        );

        if (!confirmed) return;

        try {
            await apiClient.delete(`/suppliers/${id}/`);
            this.showNotification('Supplier deleted successfully', 'success');
            await this.loadSuppliers();
        } catch (error) {
            console.error('Failed to delete supplier:', error);
            this.showNotification('Failed to delete supplier', 'error');
        }
    }

    showLoading(show) {
        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;

        if (show) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 text-muted">Loading suppliers...</p>
                    </td>
                </tr>
            `;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    async showConfirmDialog(title, message, type = 'primary') {
        return new Promise((resolve) => {
            const modalHTML = `
                <div class="modal fade" id="confirmModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${title}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body"><p>${message}</p></div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="cancelBtn">Cancel</button>
                                <button type="button" class="btn btn-${type}" id="confirmBtn">Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const existingModal = document.getElementById('confirmModal');
            if (existingModal) existingModal.remove();

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = new bootstrap.Modal(document.getElementById('confirmModal'));

            document.getElementById('confirmBtn').addEventListener('click', () => {
                modal.hide();
                resolve(true);
            });

            document.getElementById('cancelBtn').addEventListener('click', () => {
                modal.hide();
                resolve(false);
            });

            document.getElementById('confirmModal').addEventListener('hidden.bs.modal', function () {
                this.remove();
            });

            modal.show();
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global export functions for CSV import/export
window.exportSuppliers = function() {
    if (window.suppliersManager && window.suppliersManager.suppliers.length > 0) {
        const csvContent = window.suppliersManager.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `suppliers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    } else {
        alert('No suppliers to export');
    }
};

window.importSuppliers = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file && window.suppliersManager) {
            window.suppliersManager.importFromCSV(file);
        }
    };
    input.click();
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.suppliersManager = new SuppliersManager();
});

export default SuppliersManager;