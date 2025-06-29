import apiClient from '../apiClient.js';
import notificationManager from '../utils/notifications.js';

class CustomerManager {
    constructor() {
        this.customers = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalCount = 0;
        this.pageSize = 6;
        this.currentCustomer = null;
        this.isEditing = false;
        this.currentSearch = '';
        this.currentFilters = {
            status: '',
            type: ''
        };
        
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.loadCustomers();
    }

    attachEventListeners() {
        // Menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', this.toggleSidebar);
        
        // Modal controls
        document.getElementById('addCustomerBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('overlay').addEventListener('click', () => this.closeModal());
        
        // Form submission
        document.getElementById('customerForm').addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Search and filters
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('statusFilter').addEventListener('change', (e) => this.handleFilter());
        document.getElementById('typeFilter').addEventListener('change', (e) => this.handleFilter());
        
        // Pagination
        document.getElementById('prevBtn').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextBtn').addEventListener('click', () => this.changePage(1));
        
        // Confirmation modal
        document.getElementById('confirmCancel').addEventListener('click', () => this.closeConfirmModal());
        document.getElementById('confirmDelete').addEventListener('click', () => this.confirmDelete());
        
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', this.handleLogout);
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        const overlay = document.getElementById('overlay');
        
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        overlay.classList.toggle('active');
    }

    async loadCustomers(page = 1) {
        try {
            this.showLoading();
            
            // Build query parameters
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: this.pageSize.toString()
            });
            
            // Add search parameter
            if (this.currentSearch.trim()) {
                params.append('search', this.currentSearch.trim());
            }
            
            // Add filter parameters
            if (this.currentFilters.status) {
                params.append('status', this.currentFilters.status);
            }
            if (this.currentFilters.type) {
                params.append('customer_type', this.currentFilters.type);
            }
            
            console.log('Loading customers with params:', params.toString());
            const response = await apiClient.get(`/customers/customers/?${params.toString()}`);
            
            // Handle DRF pagination response more robustly
            if (response && typeof response === 'object') {
                if (response.results && Array.isArray(response.results)) {
                    // Paginated response from DRF
                    this.customers = response.results;
                    this.totalCount = response.count || 0;
                    this.currentPage = page;
                    this.totalPages = Math.ceil(this.totalCount / this.pageSize);
                    console.log('Loaded customers (paginated):', this.customers.length, 'Total:', this.totalCount, 'Page:', this.currentPage);
                } else if (Array.isArray(response)) {
                    // Direct array response (non-paginated)
                    this.customers = response;
                    this.totalCount = this.customers.length;
                    this.currentPage = 1;
                    this.totalPages = 1;
                    console.log('Loaded customers (non-paginated array):', this.customers.length);
                } else if (response.data && Array.isArray(response.data)) {
                    // Response wrapped in data property
                    this.customers = response.data;
                    this.totalCount = this.customers.length;
                    this.currentPage = 1;
                    this.totalPages = 1;
                    console.log('Loaded customers (wrapped in data):', this.customers.length);
                } else {
                    // Unknown response format
                    console.warn('Unexpected response format:', response);
                    this.customers = [];
                    this.totalCount = 0;
                    this.currentPage = 1;
                    this.totalPages = 1;
                }
            } else {
                // Invalid response
                console.error('Invalid response received:', response);
                this.customers = [];
                this.totalCount = 0;
                this.currentPage = 1;
                this.totalPages = 1;
            }
            
            this.updatePaginationControls();
            this.renderCustomers();
        } catch (error) {
            console.error('Error loading customers:', error);
            this.customers = [];
            this.totalCount = 0;
            this.currentPage = 1;
            this.totalPages = 1;
            this.updatePaginationControls();
            this.renderCustomers();
            // Provide more specific error messages
            let errorMessage = 'Failed to load customers. Please try again.';
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'Authentication failed. Please login again.';
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                } else if (error.response.status === 403) {
                    errorMessage = 'You do not have permission to view customers.';
                } else if (error.response.status === 500) {
                    errorMessage = 'Server error. Please contact support if this continues.';
                }
            } else if (error.message.includes('Network Error')) {
                errorMessage = 'Network connection failed. Please check your internet connection.';
            }
            this.showError(errorMessage);
        }
    }

    renderCustomers() {
        const container = document.getElementById('customersTableContainer');
        
        if (this.customers.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-users"></i><br>No customers found</div>';
            return;
        }

        const table = `
            <table class="customers-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Contact</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Credit Limit</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.customers.map(customer => `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="customer-avatar">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="ms-3">
                                        <h6 class="mb-0">${this.escapeHtml(customer.name)}</h6>
                                        ${customer.contact_person ? `<small class="text-muted">${this.escapeHtml(customer.contact_person)}</small>` : '<small class="text-muted">No contact person</small>'}
                                    </div>
                                </div>
                            </td>
                            <td><span class="status-badge">${this.formatCustomerType(customer.customer_type)}</span></td>
                            <td>
                                <div>
                                    ${customer.phone ? `<div><i class="fas fa-phone"></i> ${this.escapeHtml(customer.phone)}</div>` : ''}
                                    ${customer.email ? `<div><i class="fas fa-envelope"></i> ${this.escapeHtml(customer.email)}</div>` : ''}
                                </div>
                            </td>
                            <td>-</td>
                            <td><span class="status-badge status-${customer.status}">${this.formatStatus(customer.status)}</span></td>
                            <td>₦${this.formatMoney(customer.credit_limit || 0)}</td>
                            <td class="actions-cell">
                                <button class="btn btn-sm btn-warning" onclick="customerManager.editCustomer(${customer.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="customerManager.deleteCustomer(${customer.id})" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    }

    handleSearch(query) {
        this.currentSearch = query;
        this.currentPage = 1;
        // Debounce search to avoid too many API calls
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.loadCustomers(1);
        }, 500);
    }

    handleFilter() {
        const statusFilter = document.getElementById('statusFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        
        this.currentFilters.status = statusFilter;
        this.currentFilters.type = typeFilter;
        this.currentPage = 1;
        
        this.loadCustomers(1);
    }

    openModal(customer = null) {
        this.currentCustomer = customer;
        this.isEditing = !!customer;
        
        const modal = document.getElementById('customerModal');
        const title = document.getElementById('modalTitle');
        const saveBtn = document.getElementById('saveBtn');
        
        title.textContent = this.isEditing ? 'Edit Customer' : 'Add New Customer';
        saveBtn.innerHTML = `<i class="fas fa-save"></i> ${this.isEditing ? 'Update' : 'Save'} Customer`;
        
        if (this.isEditing && customer) {
            this.populateForm(customer);
        } else {
            document.getElementById('customerForm').reset();
            document.getElementById('status').value = 'active';
        }
        
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('customerModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        document.body.style.overflow = 'auto';
        this.currentCustomer = null;
        this.isEditing = false;
    }

    populateForm(customer) {
        const fields = ['customerName', 'customerType', 'contactPerson', 'email', 'phone', 
                       'alternativePhone', 'taxId', 'creditLimit', 'paymentTerms', 'status', 'notes'];
        
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                const customerField = field === 'customerName' ? 'name' : 
                                    field.replace(/([A-Z])/g, '_$1').toLowerCase();
                element.value = customer[customerField] || '';
            }
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = this.getFormData();
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.innerHTML;
        
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
        
        try {
            if (this.isEditing) {
                await apiClient.put(`/customers/customers/${this.currentCustomer.id}/`, formData);
                this.showSuccess('Customer updated successfully!');
            } else {
                await apiClient.post('/customers/customers/', formData);
                this.showSuccess('Customer added successfully!');
            }
            
            this.closeModal();
            await this.loadCustomers(this.currentPage);
        } catch (error) {
            console.error('Error saving customer:', error);
            this.showError(this.isEditing ? 'Failed to update customer.' : 'Failed to add customer.');
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    getFormData() {
        return {
            name: document.getElementById('customerName').value.trim(),
            customer_type: document.getElementById('customerType').value,
            contact_person: document.getElementById('contactPerson').value.trim() || null,
            email: document.getElementById('email').value.trim() || null,
            phone: document.getElementById('phone').value.trim(),
            alternative_phone: document.getElementById('alternativePhone').value.trim() || null,
            tax_id: document.getElementById('taxId').value.trim() || null,
            credit_limit: parseFloat(document.getElementById('creditLimit').value) || 0,
            payment_terms: document.getElementById('paymentTerms').value.trim() || null,
            status: document.getElementById('status').value,
            notes: document.getElementById('notes').value.trim() || null
        };
    }

    editCustomer(id) {
        const customer = this.customers.find(c => c.id === id);
        if (customer) {
            this.openModal(customer);
        }
    }

    deleteCustomer(id) {
        const customer = this.customers.find(c => c.id === id);
        if (customer) {
            this.currentCustomer = customer;
            document.getElementById('confirmMessage').textContent = 
                `Are you sure you want to delete "${customer.name}"?`;
            document.getElementById('confirmModal').classList.add('active');
            document.getElementById('overlay').classList.add('active');
        }
    }

    closeConfirmModal() {
        document.getElementById('confirmModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        this.currentCustomer = null;
    }

    async confirmDelete() {
        if (!this.currentCustomer) return;
        
        const confirmBtn = document.getElementById('confirmDelete');
        const originalText = confirmBtn.innerHTML;
        
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        confirmBtn.disabled = true;
        
        try {
            await apiClient.delete(`/customers/customers/${this.currentCustomer.id}/`);
            this.showSuccess('Customer deleted successfully!');
            this.closeConfirmModal();
            await this.loadCustomers(this.currentPage);
        } catch (error) {
            console.error('Error deleting customer:', error);
            this.showError('Failed to delete customer.');
        } finally {
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }
    }

    changePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.loadCustomers(newPage);
        }
    }

    updatePagination() {
        // This method is now handled in loadCustomers()
        // Keeping for compatibility but functionality moved to updatePaginationControls
        this.updatePaginationControls();
    }

    updatePaginationControls() {
        const pagination = document.getElementById('pagination');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (this.totalPages > 1) {
            pagination.style.display = 'flex';
            pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
            prevBtn.disabled = this.currentPage === 1;
            nextBtn.disabled = this.currentPage === this.totalPages;
        } else if (this.totalCount > 0) {
            pagination.style.display = 'flex';
            pageInfo.textContent = `Page 1 of 1`;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        } else {
            pagination.style.display = 'none';
        }
    }

    showLoading() {
        const message = this.currentPage > 1 ? 
            `<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading page ${this.currentPage}...</div>` :
            '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading customers...</div>';
        document.getElementById('customersTableContainer').innerHTML = message;
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

    showNotification(message, type) {
        notificationManager.showNotification(message, type);
    }

    formatCustomerType(type) {
        const types = {
            individual: 'Individual',
            company: 'Company',
            government: 'Government',
            ngo: 'NGO/Non-profit'
        };
        return types[type] || type;
    }

    formatStatus(status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    formatMoney(amount) {
        return new Intl.NumberFormat('en-NG').format(amount);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    }
}

// Initialize customer manager
const customerManager = new CustomerManager();

// Notifications are now handled by the shared notification utility

// Make customerManager globally available
window.customerManager = customerManager;