// expenses.js - Refactored with proper user handling
import apiClient from '../apiClient.js';

class ExpenseManager {
    constructor() {
        this.expenses = [];
        this.filteredExpenses = [];
        this.users = []; // Store users for paid_by dropdown
        this.currentPage = 1;
        this.itemsPerPage = 6;
        this.currentEditId = null;
        this.currentDeleteId = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadUsers(); // Load users first
        await this.loadExpenses();
        this.setupSidebar();
    }

    setupEventListeners() {
        // Add expense button
        document.getElementById('addExpenseBtn')?.addEventListener('click', () => this.showExpenseModal());
        
        // Save expense button
        document.getElementById('saveExpenseBtn')?.addEventListener('click', () => this.saveExpense());
        
        // Search functionality
        document.getElementById('searchExpense')?.addEventListener('input', (e) => this.searchExpenses(e.target.value));
        
        // Filter by type
        document.getElementById('filterType')?.addEventListener('change', (e) => this.filterByType(e.target.value));
        
        // Filter by date
        document.getElementById('filterDate')?.addEventListener('change', (e) => this.filterByDate(e.target.value));
        
        // Pagination
        document.getElementById('prevPage')?.addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage')?.addEventListener('click', () => this.changePage(1));
        
        // Confirm delete buttons
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.confirmDelete());
        
        // Close modals
        document.querySelectorAll('[data-bs-dismiss="modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
    }

    setupSidebar() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');

        menuToggle?.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });

        // Logout functionality
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        });
    }

    // Load users from API for paid_by dropdown
    async loadUsers() {
        try {
            console.log('Loading users...');
            const response = await apiClient.get('/users/');
            this.users = response.results || response;
            console.log('Users loaded:', this.users);
            this.populateUsersDropdown();
        } catch (error) {
            console.error('Error loading users:', error);
            this.showToast('Error loading users', 'error');
            // Set empty users array if API call fails
            this.users = [];
        }
    }

    // Populate the paid_by dropdown with users
    populateUsersDropdown() {
        const dropdown = document.getElementById('expensePaidBy');
        if (!dropdown) return;

        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Select User</option>';
        
        // Add user options
        this.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            // Try different common user field patterns
            const displayName = user.username || user.name || user.first_name 
                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                : user.email || `User ${user.id}`;
            option.textContent = displayName;
            dropdown.appendChild(option);
        });

        console.log('Users dropdown populated with', this.users.length, 'users');
    }

    // Get user display name by ID
    getUserDisplayName(userId) {
        if (!userId) return 'N/A';
        
        const user = this.users.find(u => u.id === parseInt(userId));
        if (!user) return 'Unknown User';
        
        // Try different common user field patterns
        return user.username || user.name || 
            (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) ||
            user.email || `User ${user.id}`;
    }

    async loadExpenses() {
        try {
            this.showLoading(true);
            console.log('Loading expenses...');
            const response = await apiClient.get('/expenses/');
            this.expenses = response.results || response;
            this.filteredExpenses = [...this.expenses];
            console.log('Expenses loaded:', this.expenses);
            this.renderExpenses();
            this.updateStats();
        } catch (error) {
            console.error('Error loading expenses:', error);
            this.showToast('Error loading expenses', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderExpenses() {
        const tbody = document.getElementById('expensesTableBody');
        if (!tbody) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedExpenses = this.filteredExpenses.slice(startIndex, endIndex);

        if (paginatedExpenses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="fas fa-receipt fa-3x text-muted mb-3"></i>
                        <p class="text-muted">No expenses found</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = paginatedExpenses.map(expense => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="expense-avatar">
                            <i class="fas fa-receipt"></i>
                        </div>
                        <div class="ms-3">
                            <h6 class="mb-0">${this.escapeHtml(expense.type)}</h6>
                            <small class="text-muted">${this.escapeHtml(expense.description || 'No description')}</small>
                        </div>
                    </div>
                </td>
                <td><strong>$${parseFloat(expense.amount || 0).toFixed(2)}</strong></td>
                <td>${new Date(expense.date).toLocaleDateString()}</td>
                <td>
                    <span class="badge bg-secondary">
                        ${this.escapeHtml(this.getUserDisplayName(expense.paid_by))}
                    </span>
                </td>
                <td>
                    <span class="badge bg-${this.getExpenseTypeBadge(expense.type)}">
                        ${this.escapeHtml(expense.type)}
                    </span>
                </td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-warning" onclick="expenseManager.editExpense(${expense.id})" title="Edit Expense">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="expenseManager.showDeleteModal(${expense.id})" title="Delete Expense">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.updatePagination();
    }

    // Helper function to escape HTML to prevent XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getExpenseTypeBadge(type) {
        const badges = {
            'delivery': 'primary',
            'transport': 'info',
            'labor': 'success',
            'maintenance': 'warning',
            'utilities': 'secondary',
            'office': 'dark',
            'other': 'light'
        };
        return badges[type?.toLowerCase()] || 'primary';
    }

    updateStats() {
        const totalExpenses = this.filteredExpenses.length;
        const totalAmount = this.filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const monthlyExpenses = this.filteredExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === thisMonth && expenseDate.getFullYear() === thisYear;
        });
        const monthlyAmount = monthlyExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

        document.getElementById('totalExpenses').textContent = totalExpenses;
        document.getElementById('totalAmount').textContent = `$${totalAmount.toFixed(2)}`;
        document.getElementById('monthlyAmount').textContent = `$${monthlyAmount.toFixed(2)}`;
    }

    showExpenseModal(expense = null) {
        this.currentEditId = expense?.id || null;
        const modal = document.getElementById('expenseModal');
        const form = document.getElementById('expenseForm');
        
        // Ensure users dropdown is populated
        this.populateUsersDropdown();
        
        if (expense) {
            document.getElementById('expenseModalLabel').textContent = 'Edit Expense';
            form.type.value = expense.type || '';
            form.amount.value = expense.amount || '';
            form.description.value = expense.description || '';
            form.date.value = expense.date || '';
            // Set the paid_by dropdown value
            form.paid_by.value = expense.paid_by || '';
            console.log('Editing expense with paid_by:', expense.paid_by);
        } else {
            document.getElementById('expenseModalLabel').textContent = 'Add New Expense';
            form.reset();
            form.date.value = new Date().toISOString().split('T')[0];
        }
        
        modal.style.display = 'block';
        modal.classList.add('show');
        document.body.classList.add('modal-open');
    }

    async saveExpense() {
        const form = document.getElementById('expenseForm');
        const formData = new FormData(form);
        
        const expenseData = {
            type: formData.get('type'),
            amount: parseFloat(formData.get('amount')),
            description: formData.get('description') || '',
            date: formData.get('date'),
            paid_by: formData.get('paid_by') || null // Handle empty string as null
        };

        console.log('Saving expense data:', expenseData);

        // Validation
        if (!expenseData.type || !expenseData.amount || !expenseData.date) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        if (expenseData.amount <= 0) {
            this.showToast('Amount must be greater than zero', 'error');
            return;
        }

        try {
            this.showLoading(true);
            if (this.currentEditId) {
                await apiClient.put(`/expenses/${this.currentEditId}/`, expenseData);
                this.showToast('Expense updated successfully', 'success');
            } else {
                await apiClient.post('/expenses/', expenseData);
                this.showToast('Expense added successfully', 'success');
            }
            
            this.closeModals();
            await this.loadExpenses();
        } catch (error) {
            console.error('Error saving expense:', error);
            
            // Handle specific API errors
            if (error.response?.data) {
                const errorData = error.response.data;
                let errorMessage = 'Error saving expense';
                
                if (typeof errorData === 'object') {
                    const errors = [];
                    Object.keys(errorData).forEach(key => {
                        if (Array.isArray(errorData[key])) {
                            errors.push(`${key}: ${errorData[key].join(', ')}`);
                        } else {
                            errors.push(`${key}: ${errorData[key]}`);
                        }
                    });
                    errorMessage = errors.join('; ') || errorMessage;
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
                
                this.showToast(errorMessage, 'error');
            } else {
                this.showToast('Error saving expense', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    editExpense(id) {
        const expense = this.expenses.find(e => e.id === id);
        if (expense) {
            console.log('Editing expense:', expense);
            this.showExpenseModal(expense);
        }
    }

    showDeleteModal(id) {
        this.currentDeleteId = id;
        const expense = this.expenses.find(e => e.id === id);
        if (expense) {
            document.getElementById('deleteExpenseDetails').innerHTML = `
                <strong>${this.escapeHtml(expense.type)}</strong><br>
                Amount: $${parseFloat(expense.amount || 0).toFixed(2)}<br>
                Date: ${new Date(expense.date).toLocaleDateString()}<br>
                Paid by: ${this.escapeHtml(this.getUserDisplayName(expense.paid_by))}
            `;
            const modal = document.getElementById('deleteModal');
            modal.style.display = 'block';
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        }
    }

    async confirmDelete() {
        if (!this.currentDeleteId) return;

        try {
            this.showLoading(true);
            await apiClient.delete(`/expenses/${this.currentDeleteId}/`);
            this.showToast('Expense deleted successfully', 'success');
            this.closeModals();
            await this.loadExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            this.showToast('Error deleting expense', 'error');
        } finally {
            this.showLoading(false);
            this.currentDeleteId = null;
        }
    }

    searchExpenses(query) {
        if (!query.trim()) {
            this.filteredExpenses = [...this.expenses];
        } else {
            const searchQuery = query.toLowerCase();
            this.filteredExpenses = this.expenses.filter(expense => {
                const typeMatch = expense.type?.toLowerCase().includes(searchQuery);
                const descriptionMatch = expense.description?.toLowerCase().includes(searchQuery);
                const userMatch = this.getUserDisplayName(expense.paid_by).toLowerCase().includes(searchQuery);
                
                return typeMatch || descriptionMatch || userMatch;
            });
        }
        this.currentPage = 1;
        this.renderExpenses();
        this.updateStats();
    }

    filterByType(type) {
        if (!type) {
            this.filteredExpenses = [...this.expenses];
        } else {
            this.filteredExpenses = this.expenses.filter(expense => expense.type === type);
        }
        this.currentPage = 1;
        this.renderExpenses();
        this.updateStats();
    }

    filterByDate(date) {
        if (!date) {
            this.filteredExpenses = [...this.expenses];
        } else {
            this.filteredExpenses = this.expenses.filter(expense => expense.date === date);
        }
        this.currentPage = 1;
        this.renderExpenses();
        this.updateStats();
    }

    changePage(direction) {
        const totalPages = Math.ceil(this.filteredExpenses.length / this.itemsPerPage);
        this.currentPage += direction;
        
        if (this.currentPage < 1) this.currentPage = 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        
        this.renderExpenses();
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredExpenses.length / this.itemsPerPage);
        
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${totalPages}`;
        
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
    }

    closeModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
            modal.classList.remove('show');
        });
        document.body.classList.remove('modal-open');
        
        // Reset current IDs
        this.currentEditId = null;
        this.currentDeleteId = null;
    }

    showLoading(show) {
        const loader = document.getElementById('loadingSpinner');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    }

    showToast(message, type) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : 'success'} border-0`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${this.escapeHtml(message)}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        // Add to toast container
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(container);
        }
        
        container.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Method to refresh users if needed
    async refreshUsers() {
        await this.loadUsers();
    }

    // Method to get current user statistics
    getExpenseStats() {
        return {
            total: this.expenses.length,
            totalAmount: this.expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0),
            byType: this.expenses.reduce((acc, expense) => {
                acc[expense.type] = (acc[expense.type] || 0) + 1;
                return acc;
            }, {}),
            byUser: this.expenses.reduce((acc, expense) => {
                const userName = this.getUserDisplayName(expense.paid_by);
                acc[userName] = (acc[userName] || 0) + parseFloat(expense.amount || 0);
                return acc;
            }, {})
        };
    }
}

// Initialize the expense manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.expenseManager = new ExpenseManager();
});