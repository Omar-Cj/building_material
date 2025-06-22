import apiClient from '../apiClient.js';

class CustomerManager {
    constructor() {
        this.customers = [];
        this.filteredCustomers = [];
        this.currentPage = 1;
        this.itemsPerPage = 6;
        this.totalPages = 1;
        this.currentCustomer = null;
        this.isEditing = false;
        
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

    async loadCustomers() {
        try {
            this.showLoading();
            const response = await apiClient.get('/customers/customers/');
            this.customers = response.results || response;
            this.filteredCustomers = [...this.customers];
            this.updatePagination();
            this.renderCustomers();
        } catch (error) {
            console.error('Error loading customers:', error);
            this.showError('Failed to load customers. Please try again.');
        }
    }

    renderCustomers() {
        const container = document.getElementById('customersTableContainer');
        
        if (this.filteredCustomers.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-users"></i><br>No customers found</div>';
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageCustomers = this.filteredCustomers.slice(startIndex, endIndex);

        const table = `
            <table class="customers-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Contact</th>
                        <th>City</th>
                        <th>Status</th>
                        <th>Credit Limit</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageCustomers.map(customer => `
                        <tr>
                            <td>
                                <div>
                                    <strong>${this.escapeHtml(customer.name)}</strong>
                                    ${customer.contact_person ? `<br><small>${this.escapeHtml(customer.contact_person)}</small>` : ''}
                                </div>
                            </td>
                            <td><span class="status-badge">${this.formatCustomerType(customer.customer_type)}</span></td>
                            <td>
                                <div>
                                    ${customer.phone ? `<div><i class="fas fa-phone"></i> ${this.escapeHtml(customer.phone)}</div>` : ''}
                                    ${customer.email ? `<div><i class="fas fa-envelope"></i> ${this.escapeHtml(customer.email)}</div>` : ''}
                                </div>
                            </td>
                            <td>${this.escapeHtml(customer.city)}, ${this.escapeHtml(customer.state)}</td>
                            <td><span class="status-badge status-${customer.status}">${this.formatStatus(customer.status)}</span></td>
                            <td>₦${this.formatMoney(customer.credit_limit || 0)}</td>
                            <td class="actions-cell">
                                <button class="btn btn-sm btn-primary" onclick="customerManager.editCustomer(${customer.id})" title="Edit">
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
        const searchTerm = query.toLowerCase().trim();
        this.filteredCustomers = this.customers.filter(customer => 
            customer.name.toLowerCase().includes(searchTerm) ||
            (customer.email && customer.email.toLowerCase().includes(searchTerm)) ||
            (customer.phone && customer.phone.includes(searchTerm)) ||
            (customer.contact_person && customer.contact_person.toLowerCase().includes(searchTerm))
        );
        this.currentPage = 1;
        this.updatePagination();
        this.renderCustomers();
    }

    handleFilter() {
        const statusFilter = document.getElementById('statusFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        
        this.filteredCustomers = this.customers.filter(customer => {
            const statusMatch = !statusFilter || customer.status === statusFilter;
            const typeMatch = !typeFilter || customer.customer_type === typeFilter;
            return statusMatch && typeMatch;
        });
        
        this.currentPage = 1;
        this.updatePagination();
        this.renderCustomers();
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
            document.getElementById('country').value = 'Nigeria';
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
                       'alternativePhone', 'address', 'city', 'state', 'postalCode', 'country', 
                       'taxId', 'creditLimit', 'paymentTerms', 'status', 'notes'];
        
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
            await this.loadCustomers();
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
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value.trim(),
            postal_code: document.getElementById('postalCode').value.trim() || null,
            country: document.getElementById('country').value.trim(),
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
            await this.loadCustomers();
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
            this.currentPage = newPage;
            this.renderCustomers();
            this.updatePaginationControls();
        }
    }

    updatePagination() {
        this.totalPages = Math.ceil(this.filteredCustomers.length / this.itemsPerPage);
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
        } else {
            pagination.style.display = 'none';
        }
    }

    showLoading() {
        document.getElementById('customersTableContainer').innerHTML = 
            '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading customers...</div>';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
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

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 3000;
        animation: slideIn 0.3s ease;
        transition: opacity 0.3s ease;
    }
    .notification.success {
        background: linear-gradient(135deg, #27ae60, #229954);
    }
    .notification.error {
        background: linear-gradient(135deg, #e74c3c, #c0392b);
    }
    @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }
`;
document.head.appendChild(style);

// Make customerManager globally available
window.customerManager = customerManager;