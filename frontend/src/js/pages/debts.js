import apiClient from '../apiClient.js';

class DebtManager {
    constructor() {
        this.debts = [];
        this.filteredDebts = [];
        this.currentPage = 1;
        this.itemsPerPage = 6;
        this.totalPages = 1;
        this.currentDebt = null;
        this.isEditing = false;
        this.customers = [];
        this.unpaidDebts = [];
        this.summaryData = {};
        
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.loadInitialData();
    }

    attachEventListeners() {
        // Menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', this.toggleSidebar);
        
        // Summary actions
        document.getElementById('materialsAnalysisBtn').addEventListener('click', () => this.showMaterialsAnalysis());
        document.getElementById('exportReportBtn').addEventListener('click', () => this.exportReport('pdf'));
        document.getElementById('printReportBtn')?.addEventListener('click', () => this.exportReport('print'));
        document.getElementById('exportCustomerBtn').addEventListener('click', () => this.exportCustomerDebts());
        document.getElementById('refreshSummaryBtn').addEventListener('click', () => this.loadSummary());
        
        // Debt actions
        document.getElementById('addDebtBtn').addEventListener('click', () => this.openDebtModal());
        document.getElementById('recordPaymentBtn').addEventListener('click', () => this.openPaymentModal());
        
        // Debt Modal controls
        document.getElementById('closeDebtModal').addEventListener('click', () => this.closeDebtModal());
        document.getElementById('cancelDebtBtn').addEventListener('click', () => this.closeDebtModal());
        document.getElementById('debtForm').addEventListener('submit', (e) => this.handleDebtSubmit(e));
        
        // Payment Modal controls
        document.getElementById('closePaymentModal').addEventListener('click', () => this.closePaymentModal());
        document.getElementById('cancelPaymentBtn').addEventListener('click', () => this.closePaymentModal());
        document.getElementById('paymentForm').addEventListener('submit', (e) => this.handlePaymentSubmit(e));
        
        // Search and filters
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('statusFilter').addEventListener('change', () => this.handleFilter());
        document.getElementById('priorityFilter').addEventListener('change', () => this.handleFilter());
        document.getElementById('dueDateFilter').addEventListener('change', () => this.handleFilter());
        
        // Pagination
        document.getElementById('prevBtn').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextBtn').addEventListener('click', () => this.changePage(1));
        
        // Confirmation modal
        document.getElementById('confirmCancel').addEventListener('click', () => this.closeConfirmModal());
        document.getElementById('confirmAction').addEventListener('click', () => this.confirmAction());
        
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', this.handleLogout);
        
        // Payment debt selection
        const paymentDebtSelect = document.getElementById('paymentDebt');
        if (paymentDebtSelect) {
            paymentDebtSelect.addEventListener('change', (e) => this.handleDebtSelection(e));
        }
        
        // Overlay
        document.getElementById('overlay').addEventListener('click', () => this.closeAllModals());
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
            window.location.href = 'index.html';
        }
    }

    async loadInitialData() {
        try {
            console.log('Starting to load initial data...');
            
            // Check if user is authenticated
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No authentication token found');
                this.showError('Please login to access the debts module.');
                window.location.href = 'login.html';
                return;
            }
            
            console.log('Token found, loading data...');
            
            await Promise.all([
                this.loadCustomers(),
                this.loadDebts(),
                this.loadSummary()
            ]);
            
            console.log('Initial data loaded successfully');
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError(`Failed to load data: ${error.message}. Please check your connection and try again.`);
        }
    }

    async loadSummary() {
        try {
            console.log('Loading debt summary...');
            const response = await apiClient.get('/debts/debts/summary/');
            console.log('Summary response:', response);
            this.summaryData = response.data || response;
            this.updateSummaryDisplay();
            console.log('Summary loaded successfully');
        } catch (error) {
            console.error('Error loading summary:', error);
            this.summaryData = {
                total_debts: 0,
                total_amount: 0,
                remaining_amount: 0,
                overdue_count: 0,
                collection_rate: 0
            };
            this.updateSummaryDisplay();
            this.showError(`Failed to load debt summary: ${error.message}`);
        }
    }

    updateSummaryDisplay() {
        if (!this.summaryData) {
            this.summaryData = {
                total_debts: 0,
                total_amount: 0,
                remaining_amount: 0,
                overdue_count: 0,
                collection_rate: 0
            };
        }

        const { 
            total_debts, 
            total_amount, 
            remaining_amount, 
            overdue_count, 
            collection_rate 
        } = this.summaryData;

        document.getElementById('totalDebtsCount').textContent = total_debts || 0;
        document.getElementById('totalAmount').textContent = this.formatCurrency(total_amount || 0);
        document.getElementById('outstandingAmount').textContent = this.formatCurrency(remaining_amount || 0);
        document.getElementById('overdueCount').textContent = overdue_count || 0;
        document.getElementById('collectionRate').textContent = `${(collection_rate || 0).toFixed(1)}%`;
    }

    async loadCustomers() {
        try {
            console.log('Loading customers...');
            const response = await apiClient.get('/customers/customers/');
            console.log('Customers response:', response);
            // Handle both paginated and non-paginated responses
            this.customers = response.data?.results || response.data || response || [];
            console.log('Customers loaded:', this.customers.length);
            this.populateCustomerDropdowns();
        } catch (error) {
            console.error('Error loading customers:', error);
            this.customers = [];
            this.showError(`Failed to load customers: ${error.message}`);
        }
    }

    populateCustomerDropdowns() {
        const customerSelect = document.getElementById('customer');
        if (customerSelect) {
            customerSelect.innerHTML = '<option value="">Select Customer</option>';
            
            this.customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.id;
                option.textContent = `${customer.name} - ${customer.phone}`;
                customerSelect.appendChild(option);
            });
        }
    }

    async loadDebts() {
        this.showLoading(true);
        try {
            console.log('Loading debts...');
            const response = await apiClient.get('/debts/debts/');
            console.log('Debts response:', response);
            // Handle both paginated and non-paginated responses
            this.debts = response.data?.results || response.data || response || [];
            console.log('Debts loaded:', this.debts.length);
            this.filteredDebts = [...this.debts];
            this.updatePagination();
            this.renderDebts();
            this.loadUnpaidDebts();
        } catch (error) {
            console.error('Error loading debts:', error);
            this.debts = [];
            this.filteredDebts = [];
            this.showError(`Failed to load debts: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async loadUnpaidDebts() {
        try {
            const unpaidStatuses = ['pending', 'overdue', 'partially_paid'];
            this.unpaidDebts = this.debts.filter(debt => 
                unpaidStatuses.includes(debt.status) && debt.remaining_amount > 0
            );
            this.populateDebtDropdown();
        } catch (error) {
            console.error('Error loading unpaid debts:', error);
        }
    }

    populateDebtDropdown() {
        const debtSelect = document.getElementById('paymentDebt');
        if (debtSelect) {
            debtSelect.innerHTML = '<option value="">Select Debt</option>';
            
            this.unpaidDebts.forEach(debt => {
                const option = document.createElement('option');
                option.value = debt.id;
                option.textContent = `Debt #${debt.id} - ${debt.customer_name} - $${debt.remaining_amount}`;
                option.dataset.remainingAmount = debt.remaining_amount;
                debtSelect.appendChild(option);
            });
        }
    }

    renderDebts() {
        const tbody = document.getElementById('debtsTableBody');
        const noData = document.getElementById('noData');
        
        if (this.filteredDebts.length === 0) {
            tbody.innerHTML = '';
            noData.style.display = 'block';
            return;
        }
        
        noData.style.display = 'none';
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageDebts = this.filteredDebts.slice(startIndex, endIndex);
        
        tbody.innerHTML = pageDebts.map(debt => this.createDebtRow(debt)).join('');
    }

    createDebtRow(debt) {
        const statusClass = `status-${debt.status.replace('_', '-')}`;
        const priorityClass = `priority-${debt.priority}`;
        const isOverdue = debt.is_overdue;
        
        return `
            <tr>
                <td>#${debt.id}</td>
                <td>
                    <div>
                        <strong>${debt.customer_name}</strong>
                        <br>
                        <small>${debt.customer_phone}</small>
                    </div>
                </td>
                <td class="amount-display">${this.formatCurrency(debt.total_amount)}</td>
                <td class="amount-display amount-positive">${this.formatCurrency(debt.paid_amount)}</td>
                <td class="amount-display ${debt.remaining_amount > 0 ? 'amount-negative' : 'amount-positive'}">
                    ${this.formatCurrency(debt.remaining_amount)}
                    ${isOverdue ? '<span class="overdue-indicator">OVERDUE</span>' : ''}
                </td>
                <td>
                    ${this.formatDate(debt.due_date)}
                    ${isOverdue ? `<br><small class="text-danger">${debt.days_overdue} days overdue</small>` : ''}
                </td>
                <td><span class="status-badge ${statusClass}">${this.formatStatus(debt.status)}</span></td>
                <td><span class="priority-badge ${priorityClass}">${debt.priority}</span></td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-info" onclick="debtManager.viewMaterials(${debt.id})" title="View Materials">
                        <i class="fas fa-boxes"></i>
                    </button>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" onclick="debtManager.exportIndividualDebt(${debt.id}, 'pdf')" title="Export PDF">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="debtManager.exportIndividualDebt(${debt.id}, 'print')" title="Print View">
                            <i class="fas fa-print"></i>
                        </button>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="debtManager.editDebt(${debt.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="debtManager.recordPaymentForDebt(${debt.id})" 
                            ${debt.status === 'paid' ? 'disabled' : ''} title="Record Payment">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="debtManager.markAsPaid(${debt.id})"
                            ${debt.status === 'paid' ? 'disabled' : ''} title="Mark as Paid">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="debtManager.deleteDebt(${debt.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    formatStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'overdue': 'Overdue',
            'partially_paid': 'Partially Paid',
            'paid': 'Paid',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    formatCurrency(amount) {
        return `$${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
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

    handleSearch(query) {
        if (!query.trim()) {
            this.filteredDebts = [...this.debts];
        } else {
            const lowercaseQuery = query.toLowerCase();
            this.filteredDebts = this.debts.filter(debt =>
                debt.customer_name.toLowerCase().includes(lowercaseQuery) ||
                debt.customer_phone.toLowerCase().includes(lowercaseQuery) ||
                (debt.notes && debt.notes.toLowerCase().includes(lowercaseQuery)) ||
                debt.id.toString().includes(lowercaseQuery)
            );
        }
        this.currentPage = 1;
        this.updatePagination();
        this.renderDebts();
    }

    handleFilter() {
        const statusFilter = document.getElementById('statusFilter').value;
        const priorityFilter = document.getElementById('priorityFilter').value;
        const dueDateFilter = document.getElementById('dueDateFilter').value;
        
        this.filteredDebts = this.debts.filter(debt => {
            let matches = true;
            
            if (statusFilter && debt.status !== statusFilter) {
                matches = false;
            }
            
            if (priorityFilter && debt.priority !== priorityFilter) {
                matches = false;
            }
            
            if (dueDateFilter) {
                const debtDate = new Date(debt.due_date);
                const filterDate = new Date(dueDateFilter);
                if (debtDate.toDateString() !== filterDate.toDateString()) {
                    matches = false;
                }
            }
            
            return matches;
        });
        
        this.currentPage = 1;
        this.updatePagination();
        this.renderDebts();
    }

    updatePagination() {
        this.totalPages = Math.ceil(this.filteredDebts.length / this.itemsPerPage);
        
        document.getElementById('prevBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextBtn').disabled = this.currentPage >= this.totalPages;
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }

    changePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.renderDebts();
            this.updatePagination();
        }
    }

    openDebtModal(debt = null) {
        this.currentDebt = debt;
        this.isEditing = !!debt;
        
        const modal = document.getElementById('debtModal');
        const title = document.getElementById('debtModalTitle');
        const form = document.getElementById('debtForm');
        
        title.textContent = debt ? 'Edit Debt' : 'Add New Debt';
        
        if (debt) {
            this.populateDebtForm(debt);
        } else {
            form.reset();
            // Set default due date to 30 days from now
            const defaultDueDate = new Date();
            defaultDueDate.setDate(defaultDueDate.getDate() + 30);
            document.getElementById('dueDate').value = defaultDueDate.toISOString().split('T')[0];
        }
        
        this.showModal(modal);
    }

    populateDebtForm(debt) {
        document.getElementById('customer').value = debt.customer;
        document.getElementById('totalAmount').value = debt.total_amount;
        document.getElementById('dueDate').value = debt.due_date;
        document.getElementById('priority').value = debt.priority;
        document.getElementById('interestRate').value = debt.interest_rate;
        document.getElementById('paymentTerms').value = debt.payment_terms || '';
        document.getElementById('notes').value = debt.notes || '';
    }

    closeDebtModal() {
        this.closeModal('debtModal');
        this.currentDebt = null;
        this.isEditing = false;
    }

    async handleDebtSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const debtData = {
            customer: parseInt(formData.get('customer')),
            total_amount: parseFloat(formData.get('totalAmount')),
            due_date: formData.get('dueDate'),
            priority: formData.get('priority'),
            interest_rate: parseFloat(formData.get('interestRate')) || 0,
            payment_terms: formData.get('paymentTerms') || '',
            notes: formData.get('notes') || ''
        };
        
        try {
            if (this.isEditing) {
                await apiClient.put(`/debts/debts/${this.currentDebt.id}/`, debtData);
                this.showSuccess('Debt updated successfully!');
            } else {
                await apiClient.post('/debts/debts/', debtData);
                this.showSuccess('Debt added successfully!');
            }
            
            this.closeDebtModal();
            await this.loadDebts();
            await this.loadSummary();
        } catch (error) {
            console.error('Error saving debt:', error);
            this.showError('Failed to save debt. Please check the form and try again.');
        }
    }

    openPaymentModal(debtId = null) {
        const modal = document.getElementById('paymentModal');
        const form = document.getElementById('paymentForm');
        
        if (!modal || !form) {
            this.showError('Payment modal not found. Please refresh the page.');
            return;
        }
        
        form.reset();
        
        // Set current date and time
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const paymentDateInput = document.getElementById('paymentDate');
        if (paymentDateInput) {
            paymentDateInput.value = localDateTime;
        }
        
        if (debtId) {
            const debtSelect = document.getElementById('paymentDebt');
            if (debtSelect) {
                debtSelect.value = debtId;
                
                // Find the debt and set up the payment amount field
                const debt = this.debts.find(d => d.id == debtId);
                if (debt) {
                    const paymentAmountInput = document.getElementById('paymentAmount');
                    if (paymentAmountInput) {
                        paymentAmountInput.max = debt.remaining_amount;
                        paymentAmountInput.placeholder = `Max: $${parseFloat(debt.remaining_amount).toFixed(2)}`;
                    }
                }
            }
        }
        
        this.showModal(modal);
    }

    recordPaymentForDebt(debtId) {
        this.openPaymentModal(debtId);
    }

    handleDebtSelection(e) {
        try {
            const selectElement = e.target;
            if (!selectElement || !selectElement.selectedOptions || selectElement.selectedOptions.length === 0) {
                console.log('No valid selection found');
                return;
            }
            
            const selectedOption = selectElement.selectedOptions[0];
            if (!selectedOption) {
                console.log('No selected option found');
                return;
            }
            
            // Try to get remaining amount from data attribute or find debt by ID
            let remainingAmount = 0;
            if (selectedOption.dataset && selectedOption.dataset.remainingAmount) {
                remainingAmount = parseFloat(selectedOption.dataset.remainingAmount);
            } else {
                // Fallback: find debt by value
                const debtId = parseInt(selectedOption.value);
                const debt = this.debts.find(d => d.id === debtId);
                if (debt && debt.remaining_amount) {
                    remainingAmount = parseFloat(debt.remaining_amount);
                }
            }
            
            const paymentAmountInput = document.getElementById('paymentAmount');
            if (paymentAmountInput && remainingAmount > 0) {
                paymentAmountInput.max = remainingAmount;
                paymentAmountInput.placeholder = `Max: $${remainingAmount.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error in handleDebtSelection:', error);
        }
    }

    closePaymentModal() {
        this.closeModal('paymentModal');
    }

    async handlePaymentSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const paymentData = {
            debt: parseInt(formData.get('paymentDebt')),
            customer: this.getCustomerFromDebt(parseInt(formData.get('paymentDebt'))),
            amount: parseFloat(formData.get('paymentAmount')),
            payment_method: formData.get('paymentMethod'),
            payment_date: formData.get('paymentDate'),
            reference_number: formData.get('referenceNumber') || '',
            receipt_number: formData.get('receiptNumber') || '',
            notes: formData.get('paymentNotes') || ''
        };
        
        try {
            await apiClient.post('/debts/payments/', paymentData);
            this.showSuccess('Payment recorded successfully!');
            this.closePaymentModal();
            await this.loadDebts();
            await this.loadSummary();
        } catch (error) {
            console.error('Error recording payment:', error);
            this.showError('Failed to record payment. Please check the form and try again.');
        }
    }

    getCustomerFromDebt(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        return debt ? debt.customer : null;
    }

    async editDebt(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (debt) {
            this.openDebtModal(debt);
        }
    }

    async markAsPaid(debtId) {
        this.showConfirmModal(
            'Mark debt as paid?',
            'This will mark the debt as fully paid. This action cannot be undone.',
            async () => {
                try {
                    await apiClient.post(`/debts/debts/${debtId}/mark_paid/`, {
                        payment_method: 'cash'
                    });
                    this.showSuccess('Debt marked as paid!');
                    await this.loadDebts();
                    await this.loadSummary();
                } catch (error) {
                    console.error('Error marking debt as paid:', error);
                    this.showError('Failed to mark debt as paid.');
                }
            }
        );
    }

    async viewMaterials(debtId) {
        try {
            console.log('Fetching materials for debt:', debtId);
            const response = await apiClient.get(`/debts/debts/${debtId}/materials/`);
            console.log('Materials response:', response);
            
            // Handle different response structures
            const data = response.data || response;
            console.log('Parsed data:', data);
            
            if (!data) {
                this.showError('No data received from server.');
                return;
            }
            
            if (!data.materials || !Array.isArray(data.materials) || data.materials.length === 0) {
                this.showError('No materials found for this debt or debt is not associated with a sale.');
                return;
            }
            
            this.showMaterialsModal(debtId, data);
        } catch (error) {
            console.error('Error fetching materials:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
            this.showError(`Failed to load material details: ${errorMessage}`);
        }
    }
    
    showMaterialsModal(debtId, data) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) {
            this.showError('Debt not found in local data.');
            return;
        }
        
        // Safely extract data with fallbacks
        const saleDate = data.sale_date || debt.created_at || 'N/A';
        const materialsCount = data.materials_count || data.materials?.length || 0;
        const materials = data.materials || [];
        
        const modalHTML = `
            <div class="modal-overlay" id="materialsModalOverlay">
                <div class="modal-content materials-modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-boxes"></i> Materials in Debt #${debtId}</h3>
                        <button class="close-btn" onclick="debtManager.closeMaterialsModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="debt-info-card">
                            <div class="row">
                                <div class="col">
                                    <strong>Customer:</strong> ${debt.customer_name || 'N/A'}
                                </div>
                                <div class="col">
                                    <strong>Sale Date:</strong> ${this.formatDate(saleDate)}
                                </div>
                                <div class="col">
                                    <strong>Total Materials:</strong> ${materialsCount}
                                </div>
                            </div>
                        </div>
                        
                        <div class="materials-table-container">
                            <table class="materials-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>SKU</th>
                                        <th>Category</th>
                                        <th>Quantity</th>
                                        <th>Unit Price</th>
                                        <th>Total Value</th>
                                        <th>Remaining Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${materials.map(material => `
                                        <tr>
                                            <td>
                                                <strong>${material.material_name || 'N/A'}</strong>
                                            </td>
                                            <td><span class="sku-badge">${material.material_sku || 'N/A'}</span></td>
                                            <td><span class="category-badge">${material.category || 'N/A'}</span></td>
                                            <td>${material.quantity || 0} ${material.unit || ''}</td>
                                            <td>${this.formatCurrency(material.price_per_unit || 0)}</td>
                                            <td><strong>${this.formatCurrency(material.total_value || 0)}</strong></td>
                                            <td class="remaining-value">
                                                <strong class="${(material.remaining_value || 0) > 0 ? 'amount-negative' : 'amount-positive'}">
                                                    ${this.formatCurrency(material.remaining_value || 0)}
                                                </strong>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="materials-summary">
                            <div class="summary-card">
                                <div class="row">
                                    <div class="col">
                                        <span class="summary-label">Total Debt:</span>
                                        <span class="summary-value">${this.formatCurrency(debt.total_amount)}</span>
                                    </div>
                                    <div class="col">
                                        <span class="summary-label">Paid Amount:</span>
                                        <span class="summary-value amount-positive">${this.formatCurrency(debt.paid_amount)}</span>
                                    </div>
                                    <div class="col">
                                        <span class="summary-label">Remaining:</span>
                                        <span class="summary-value amount-negative">${this.formatCurrency(debt.remaining_amount)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="debtManager.closeMaterialsModal()">Close</button>
                        <button class="btn btn-primary" onclick="debtManager.recordPaymentForDebt(${debtId}); debtManager.closeMaterialsModal();">
                            <i class="fas fa-money-bill-wave"></i> Record Payment
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    closeMaterialsModal() {
        const modal = document.getElementById('materialsModalOverlay');
        if (modal) {
            modal.remove();
        }
    }

    async deleteDebt(debtId) {
        this.showConfirmModal(
            'Delete this debt?',
            'This action cannot be undone. Are you sure you want to delete this debt?',
            async () => {
                try {
                    await apiClient.delete(`/debts/debts/${debtId}/`);
                    this.showSuccess('Debt deleted successfully!');
                    await this.loadDebts();
                    await this.loadSummary();
                } catch (error) {
                    console.error('Error deleting debt:', error);
                    this.showError('Failed to delete debt.');
                }
            }
        );
    }

    async showMaterialsAnalysis() {
        try {
            console.log('Fetching materials analysis...');
            const response = await apiClient.get('/debts/debts/materials_analysis/');
            console.log('Materials analysis response:', response);
            
            const data = response.data || response;
            console.log('Parsed analysis data:', data);
            
            if (!data) {
                this.showError('No data received from server.');
                return;
            }
            
            this.displayMaterialsAnalysisModal(data);
        } catch (error) {
            console.error('Error fetching materials analysis:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
            this.showError(`Failed to load materials analysis: ${errorMessage}`);
        }
    }
    
    displayMaterialsAnalysisModal(data) {
        // Safely extract data with fallbacks
        const summary = data.summary || {};
        const materialsAnalysis = data.materials_analysis || [];
        
        // Check if there are any materials to analyze
        if (materialsAnalysis.length === 0) {
            this.showError('No materials found in debt records to analyze.');
            return;
        }
        
        // Provide default values for summary fields
        const totalMaterials = summary.total_materials || materialsAnalysis.length || 0;
        const totalOutstandingValue = summary.total_outstanding_value || 0;
        const totalOverdueValue = summary.total_overdue_value || 0;
        const mostValuableMaterial = summary.most_valuable_material || null;
        
        const modalHTML = `
            <div class="modal-overlay" id="materialsAnalysisOverlay">
                <div class="modal-content materials-modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-chart-bar"></i> Materials Debt Analysis</h3>
                        <button class="close-btn" onclick="debtManager.closeMaterialsAnalysisModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="analysis-summary">
                            <div class="summary-card">
                                <div class="row">
                                    <div class="col">
                                        <span class="summary-label">Total Materials:</span>
                                        <span class="summary-value">${totalMaterials}</span>
                                    </div>
                                    <div class="col">
                                        <span class="summary-label">Outstanding Value:</span>
                                        <span class="summary-value amount-negative">${this.formatCurrency(totalOutstandingValue)}</span>
                                    </div>
                                    <div class="col">
                                        <span class="summary-label">Overdue Value:</span>
                                        <span class="summary-value amount-negative">${this.formatCurrency(totalOverdueValue)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="materials-table-container">
                            <table class="materials-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>SKU</th>
                                        <th>Total Debts</th>
                                        <th>Customers</th>
                                        <th>Quantity</th>
                                        <th>Total Value</th>
                                        <th>Outstanding</th>
                                        <th>Overdue</th>
                                        <th>Avg/Unit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${materialsAnalysis.map(material => `
                                        <tr>
                                            <td><strong>${material.material_name || 'N/A'}</strong></td>
                                            <td><span class="sku-badge">${material.material_sku || 'N/A'}</span></td>
                                            <td>${material.total_debts || 0}</td>
                                            <td>${material.customers_count || 0}</td>
                                            <td>${(material.total_quantity || 0).toFixed(2)}</td>
                                            <td>${this.formatCurrency(material.total_value || 0)}</td>
                                            <td class="amount-negative"><strong>${this.formatCurrency(material.outstanding_value || 0)}</strong></td>
                                            <td class="${(material.overdue_value || 0) > 0 ? 'amount-negative' : ''}">${this.formatCurrency(material.overdue_value || 0)}</td>
                                            <td>${this.formatCurrency(material.avg_debt_per_unit || 0)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        ${mostValuableMaterial ? `
                            <div class="insight-card">
                                <h5><i class="fas fa-lightbulb"></i> Key Insight</h5>
                                <p>Highest outstanding debt material: <strong>${mostValuableMaterial.material_name || 'N/A'}</strong> with ${this.formatCurrency(mostValuableMaterial.outstanding_value || 0)} outstanding across ${mostValuableMaterial.customers_count || 0} customers.</p>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="debtManager.closeMaterialsAnalysisModal()">Close</button>
                        <button class="btn btn-warning" onclick="debtManager.exportReport(); debtManager.closeMaterialsAnalysisModal();">
                            <i class="fas fa-file-pdf"></i> Export PDF Report
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    closeMaterialsAnalysisModal() {
        const modal = document.getElementById('materialsAnalysisOverlay');
        if (modal) {
            modal.remove();
        }
    }

    async exportReport(format = 'pdf') {
        // Show loading state
        const exportBtn = document.getElementById('exportReportBtn');
        if (!exportBtn) {
            this.showError('Export button not found.');
            return;
        }
        
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
        exportBtn.disabled = true;
        
        try {
            console.log('Starting report export with format:', format);
            
            if (format === 'print') {
                await this.showPrintableReport();
                return;
            }
            
            // Make API request for blob download
            const response = await apiClient.get('/debts/debts/export_report/', {
                responseType: 'blob',
                timeout: 60000 // 60 second timeout
            });
            
            console.log('Export response received:', response);
            
            // Validate blob response
            if (!response || !response.data) {
                throw new Error('No data received from server');
            }
            
            const blob = response.data;
            
            // Validate blob size
            if (blob.size === 0) {
                throw new Error('Empty file received from server');
            }
            
            // Validate content type
            if (!blob.type.includes('pdf') && !blob.type.includes('application/octet-stream')) {
                console.warn('Unexpected content type:', blob.type);
            }
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            link.download = `debt_report_${timestamp}.pdf`;
            
            // Download the file
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up URL object
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 1000);
            
            this.showSuccess('Debt report exported successfully! Check your downloads folder.');
            console.log('Report exported successfully');
            
        } catch (error) {
            console.error('Error exporting report:', error);
            
            // Handle different types of errors
            let errorMessage = 'Failed to export report.';
            
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'Authentication failed. Please login again.';
                } else if (error.response.status === 403) {
                    errorMessage = 'You do not have permission to export reports.';
                } else if (error.response.status === 500) {
                    errorMessage = 'Server error occurred while generating report.';
                } else if (error.response.status === 404) {
                    errorMessage = 'Export endpoint not found. Please contact support.';
                } else if (error.response.data) {
                    // Try to read error from blob if it's JSON
                    try {
                        const text = await error.response.data.text();
                        const errorData = JSON.parse(text);
                        if (errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        // If not JSON, use default message
                        errorMessage = 'Server returned an error response.';
                    }
                }
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMessage = 'Export timeout. The report is too large. Please try the printable view instead or contact support.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showError(errorMessage);
            
            // Offer printable alternative on failure
            setTimeout(() => {
                if (confirm('PDF export failed. Would you like to view a printable version instead?')) {
                    this.showPrintableReport();
                }
            }, 2000);
            
        } finally {
            // Restore button state
            if (exportBtn) {
                exportBtn.innerHTML = originalText;
                exportBtn.disabled = false;
            }
        }
    }

    async exportIndividualDebt(debtId, format = 'pdf') {
        try {
            console.log('Exporting individual debt:', debtId, 'Format:', format);
            
            // Find the debt for reference
            const debt = this.debts.find(d => d.id === debtId);
            if (!debt) {
                this.showError('Debt not found.');
                return;
            }
            
            if (format === 'print') {
                await this.showPrintableDebtStatement(debtId);
                return;
            }
            
            this.showSuccess('Generating debt statement, please wait...');
            
            // Make API request for blob download
            const response = await apiClient.get(`/debts/debts/${debtId}/export_individual/`, {
                responseType: 'blob',
                timeout: 30000 // 30 second timeout
            });
            
            console.log('Individual debt export response received:', response);
            
            // Validate response
            if (!response || !response.data) {
                throw new Error('No data received from server');
            }
            
            const blob = response.data;
            
            // Validate blob
            if (blob.size === 0) {
                throw new Error('Empty file received from server');
            }
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Generate safe filename
            const safeCustomerName = this.sanitizeFilename(debt.customer_name);
            const timestamp = new Date().toISOString().slice(0, 10);
            link.download = `debt_${debtId}_${safeCustomerName}_${timestamp}.pdf`;
            
            // Download the file
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up URL object
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 1000);
            
            this.showSuccess(`Debt statement for ${debt.customer_name} exported successfully!`);
            
        } catch (error) {
            console.error('Error exporting individual debt:', error);
            
            let errorMessage = 'Failed to export debt statement.';
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'Authentication failed. Please login again.';
                } else if (error.response.status === 404) {
                    errorMessage = 'Debt not found or has been deleted.';
                } else if (error.response.status === 500) {
                    errorMessage = 'Server error while generating statement.';
                } else if (error.response.data) {
                    try {
                        const text = await error.response.data.text();
                        const errorData = JSON.parse(text);
                        if (errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        errorMessage = 'Server returned an error response.';
                    }
                }
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMessage = 'Export timeout. Please try the printable view instead.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showError(errorMessage);
            
            // Offer printable alternative
            setTimeout(() => {
                if (confirm('PDF export failed. Would you like to view a printable version instead?')) {
                    this.showPrintableDebtStatement(debtId);
                }
            }, 2000);
        }
    }

    async exportCustomerDebts() {
        try {
            // Ensure data is loaded before opening modal
            if (!this.customers || this.customers.length === 0) {
                this.showError('Loading customer data, please wait...');
                await this.loadCustomers();
            }
            
            if (!this.debts || this.debts.length === 0) {
                this.showError('Loading debt data, please wait...');
                await this.loadDebts();
            }
            
            // Create customer selection modal
            this.showCustomerExportModal();
        } catch (error) {
            console.error('Error opening customer export modal:', error);
            this.showError('Failed to open customer export dialog.');
        }
    }

    showCustomerExportModal() {
        // Check if customers are loaded
        if (!this.customers || this.customers.length === 0) {
            this.showError('Customer data is not loaded yet. Please wait a moment and try again.');
            return;
        }
        
        console.log('Opening customer export modal with', this.customers.length, 'customers');
        
        const modalHTML = `
            <div class="modal-overlay" id="customerExportModalOverlay">
                <div class="modal-content customer-export-modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-file-export"></i> Export Customer Debt Report</h3>
                        <button class="close-btn" onclick="debtManager.closeCustomerExportModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label" for="exportCustomerSelect">Select Customer *</label>
                            <select class="form-input" id="exportCustomerSelect" required>
                                <option value="">Choose a customer...</option>
                                ${this.customers.map(customer => `
                                    <option value="${customer.id}">${customer.name} - ${customer.phone}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="customer-debt-info" id="customerDebtInfo" style="display: none;">
                            <div class="info-card">
                                <h4>Customer Debt Summary</h4>
                                <div id="customerDebtDetails"></div>
                            </div>
                        </div>
                        
                        <div class="export-options">
                            <h4>Export Options</h4>
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="includePaymentHistory" checked>
                                    Include payment history
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="includeMaterialsBreakdown" checked>
                                    Include materials breakdown
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="includeContactInfo" checked>
                                    Include customer contact information
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="debtManager.closeCustomerExportModal()">Cancel</button>
                        <div class="btn-group">
                            <button class="btn btn-primary" id="exportCustomerReportBtn" onclick="debtManager.processCustomerExport('pdf')" disabled>
                                <i class="fas fa-file-pdf"></i> Export PDF
                            </button>
                            <button class="btn btn-outline-primary" id="printCustomerReportBtn" onclick="debtManager.processCustomerExport('print')" disabled>
                                <i class="fas fa-print"></i> Print View
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listener for customer selection (with slight delay to ensure DOM is ready)
        setTimeout(() => {
            const customerSelect = document.getElementById('exportCustomerSelect');
            if (customerSelect) {
                customerSelect.addEventListener('change', (e) => this.handleCustomerExportSelection(e));
                console.log('Customer selection event listener attached');
            } else {
                console.error('Customer select element not found when trying to attach event listener');
            }
        }, 10);
    }

    handleCustomerExportSelection(e) {
        const customerId = e.target.value;
        const customerDebtInfo = document.getElementById('customerDebtInfo');
        const exportBtn = document.getElementById('exportCustomerReportBtn');
        
        console.log('Customer selection changed:', customerId);
        console.log('Available customers:', this.customers.length);
        console.log('Available debts:', this.debts.length);
        console.log('Export button found:', !!exportBtn);
        
        if (!customerId) {
            if (customerDebtInfo) customerDebtInfo.style.display = 'none';
            if (exportBtn) exportBtn.disabled = true;
            return;
        }
        
        if (!exportBtn) {
            console.error('Export button not found in modal');
            return;
        }
        
        // Find customer debts - try both customer ID and customer field comparison
        const customerIdInt = parseInt(customerId);
        const customerDebts = this.debts.filter(debt => {
            // Try multiple ways to match customer
            return debt.customer === customerIdInt || 
                   debt.customer === customerId || 
                   debt.customer_id === customerIdInt ||
                   debt.customer_id === customerId;
        });
        
        const customer = this.customers.find(c => c.id === customerIdInt);
        
        console.log('Found customer:', customer);
        console.log('Found debts for customer:', customerDebts.length);
        
        if (customer) {
            const totalDebts = customerDebts.length;
            const totalAmount = customerDebts.reduce((sum, debt) => sum + parseFloat(debt.total_amount || 0), 0);
            const totalOutstanding = customerDebts.reduce((sum, debt) => sum + parseFloat(debt.remaining_amount || 0), 0);
            
            const detailsHTML = `
                <div class="debt-summary-grid">
                    <div class="summary-item">
                        <span class="label">Customer:</span>
                        <span class="value">${customer.name}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Debts:</span>
                        <span class="value">${totalDebts}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Amount:</span>
                        <span class="value">${this.formatCurrency(totalAmount)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Outstanding:</span>
                        <span class="value ${totalOutstanding > 0 ? 'amount-negative' : 'amount-positive'}">${this.formatCurrency(totalOutstanding)}</span>
                    </div>
                    ${totalDebts === 0 ? `
                    <div class="summary-item" style="grid-column: 1 / -1;">
                        <span class="label" style="color: #856404;">Note:</span>
                        <span class="value" style="color: #856404;">This customer has no debts, but you can still generate a report.</span>
                    </div>
                    ` : ''}
                </div>
            `;
            
            const customerDebtDetailsEl = document.getElementById('customerDebtDetails');
            if (customerDebtDetailsEl) {
                customerDebtDetailsEl.innerHTML = detailsHTML;
            }
            if (customerDebtInfo) {
                customerDebtInfo.style.display = 'block';
            }
            
            // Enable export buttons if customer is found (even if no debts)
            if (exportBtn) {
                exportBtn.disabled = false;
                console.log('Export button enabled for customer:', customer.name);
            }
            const printBtn = document.getElementById('printCustomerReportBtn');
            if (printBtn) {
                printBtn.disabled = false;
            }
        } else {
            console.log('Customer not found in customers array');
            if (exportBtn) {
                exportBtn.disabled = true;
            }
            const printBtn = document.getElementById('printCustomerReportBtn');
            if (printBtn) {
                printBtn.disabled = true;
            }
        }
    }

    async processCustomerExport(format = 'pdf') {
        const exportBtn = document.getElementById('exportCustomerReportBtn');
        let originalText = '';
        
        // Validate inputs first
        const customerId = document.getElementById('exportCustomerSelect')?.value;
        if (!customerId) {
            this.showError('Please select a customer first.');
            return;
        }
        
        const customer = this.customers.find(c => c.id === parseInt(customerId));
        if (!customer) {
            this.showError('Selected customer not found.');
            return;
        }
        
        if (!exportBtn) {
            console.error('Export button not found in modal during export process');
            this.showError('Export button not found. Please close and reopen the modal.');
            return;
        }
        
        // Show loading state
        originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
        exportBtn.disabled = true;
        
        try {
            console.log('Starting customer export for:', customer.name, 'Format:', format);
            
            if (format === 'print') {
                await this.showPrintableCustomerReport(customerId);
                return;
            }
            
            this.showSuccess('Generating customer debt report, please wait...');
                
            // Make API request for blob download
            const response = await apiClient.get(`/debts/debts/export_customer/?customer_id=${customerId}`, {
                responseType: 'blob',
                timeout: 45000 // 45 second timeout
            });
            
            console.log('Customer export response received:', response);
            
            // Validate response
            if (!response || !response.data) {
                throw new Error('No data received from server');
            }
            
            const blob = response.data;
            
            // Validate blob
            if (blob.size === 0) {
                throw new Error('Empty file received from server');
            }
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Generate safe filename
            const safeCustomerName = this.sanitizeFilename(customer.name);
            const timestamp = new Date().toISOString().slice(0, 10);
            link.download = `customer_${customerId}_${safeCustomerName}_debt_report_${timestamp}.pdf`;
            
            // Download the file
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up URL object
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 1000);
            
            this.showSuccess(`Customer debt report for ${customer.name} exported successfully!`);
            this.closeCustomerExportModal();
            
        } catch (error) {
            console.error('Error exporting customer debts:', error);
            
            let errorMessage = 'Failed to export customer debt report.';
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'Authentication failed. Please login again.';
                } else if (error.response.status === 404) {
                    errorMessage = 'Customer not found or export endpoint unavailable.';
                } else if (error.response.status === 500) {
                    errorMessage = 'Server error while generating report.';
                } else if (error.response.data) {
                    try {
                        const text = await error.response.data.text();
                        const errorData = JSON.parse(text);
                        if (errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        errorMessage = 'Server returned an error response.';
                    }
                }
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMessage = 'Export timeout. Please try the printable view instead.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showError(errorMessage);
            
            // Offer printable alternative
            setTimeout(() => {
                if (confirm('PDF export failed. Would you like to view a printable version instead?')) {
                    this.showPrintableCustomerReport(customerId);
                }
            }, 2000);
            
        } finally {
            // Restore button state
            if (exportBtn && originalText) {
                exportBtn.innerHTML = originalText;
                exportBtn.disabled = false;
            }
        }
    }

    closeCustomerExportModal() {
        const modal = document.getElementById('customerExportModalOverlay');
        if (modal) {
            modal.remove();
        }
    }

    showModal(modal) {
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.classList.remove('active'));
        document.getElementById('overlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmMessage');
        const titleEl = document.getElementById('confirmTitle');
        
        if (titleEl) {
            titleEl.textContent = title;
        }
        messageEl.textContent = message;
        this.pendingAction = onConfirm;
        this.showModal(modal);
    }

    closeConfirmModal() {
        this.closeModal('confirmModal');
        this.pendingAction = null;
    }

    async confirmAction() {
        if (this.pendingAction) {
            await this.pendingAction();
            this.closeConfirmModal();
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const table = document.querySelector('.table-container');
        
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
        
        if (table) {
            table.style.display = show ? 'none' : 'block';
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.innerHTML = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 10000;
                    animation: slideInRight 0.3s ease;
                }
                .notification-success {
                    background: linear-gradient(135deg, #27ae60, #229954);
                }
                .notification-error {
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Show printable debt report
    async showPrintableReport() {
        try {
            console.log('Loading printable debt report...');
            
            // Get data for the report
            const [summaryResponse, debtsResponse, materialsResponse] = await Promise.all([
                apiClient.get('/debts/debts/summary/'),
                apiClient.get('/debts/debts/'),
                apiClient.get('/debts/debts/materials_analysis/')
            ]);
            
            const summary = summaryResponse.data || summaryResponse;
            const debts = debtsResponse.data?.results || debtsResponse.data || debtsResponse || [];
            const materials = materialsResponse.data || materialsResponse;
            
            this.renderPrintableReport({
                summary,
                debts: debts.slice(0, 50), // Limit to 50 debts for performance
                materials: materials.materials_analysis || [],
                materialsSum: materials.summary || {}
            });
            
        } catch (error) {
            console.error('Error loading printable report data:', error);
            this.showError('Failed to load report data. Please try again.');
        }
    }

    // Show printable customer debt report
    async showPrintableCustomerReport(customerId) {
        try {
            console.log('Loading printable customer report for:', customerId);
            
            const response = await apiClient.get(`/debts/debts/export_customer/?customer_id=${customerId}`);
            const data = response.data || response;
            
            this.renderPrintableCustomerReport(data);
            
        } catch (error) {
            console.error('Error loading customer report data:', error);
            this.showError('Failed to load customer report data. Please try again.');
        }
    }

    // Show printable individual debt statement
    async showPrintableDebtStatement(debtId) {
        try {
            console.log('Loading printable debt statement for:', debtId);
            
            const debt = this.debts.find(d => d.id == debtId);
            if (!debt) {
                this.showError('Debt not found.');
                return;
            }
            
            // Get materials and payment data
            const [materialsResponse] = await Promise.all([
                apiClient.get(`/debts/debts/${debtId}/materials/`).catch(() => null)
            ]);
            
            const materialsData = materialsResponse?.data || materialsResponse || { materials: [] };
            
            this.renderPrintableDebtStatement(debt, materialsData);
            
        } catch (error) {
            console.error('Error loading debt statement data:', error);
            this.showError('Failed to load debt statement data. Please try again.');
        }
    }

    // Render printable comprehensive debt report
    renderPrintableReport(data) {
        const reportHTML = `
            <div class="print-report show" id="printableReport">
                <div class="print-content">
                    <div class="company-header">
                        <h1 class="company-name">NurBuild Management System</h1>
                        <p class="company-subtitle">Building Materials & Construction Supplies</p>
                        <h2 class="report-title">Comprehensive Debt Report</h2>
                        <p class="report-date">Generated on ${new Date().toLocaleDateString('en-US', { 
                            year: 'numeric', month: 'long', day: 'numeric' 
                        })}</p>
                    </div>
                    
                    <div class="summary-section">
                        <h3 class="section-header">Executive Summary</h3>
                        <div class="summary-cards">
                            <div class="summary-card">
                                <h4>Total Debts</h4>
                                <div class="amount">${data.summary.total_debts || 0}</div>
                            </div>
                            <div class="summary-card">
                                <h4>Total Amount</h4>
                                <div class="amount">${this.formatCurrency(data.summary.total_amount || 0)}</div>
                            </div>
                            <div class="summary-card paid">
                                <h4>Paid Amount</h4>
                                <div class="amount">${this.formatCurrency(data.summary.paid_amount || 0)}</div>
                            </div>
                            <div class="summary-card outstanding">
                                <h4>Outstanding</h4>
                                <div class="amount">${this.formatCurrency(data.summary.remaining_amount || 0)}</div>
                            </div>
                            <div class="summary-card">
                                <h4>Overdue Count</h4>
                                <div class="amount">${data.summary.overdue_count || 0}</div>
                            </div>
                            <div class="summary-card">
                                <h4>Collection Rate</h4>
                                <div class="amount">${(data.summary.collection_rate || 0).toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                    
                    ${data.materials.length > 0 ? `
                    <div class="materials-section">
                        <h3 class="section-header">Top Materials in Debt</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>SKU</th>
                                    <th>Outstanding Value</th>
                                    <th>Customers</th>
                                    <th>Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.materials.slice(0, 10).map(material => `
                                    <tr>
                                        <td><strong>${material.material_name || 'N/A'}</strong></td>
                                        <td>${material.material_sku || 'N/A'}</td>
                                        <td class="amount-negative">${this.formatCurrency(material.outstanding_value || 0)}</td>
                                        <td>${material.customers_count || 0}</td>
                                        <td>${(material.total_quantity || 0).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}
                    
                    <div class="debts-section">
                        <h3 class="section-header">Debt Records (Top 50)</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Customer</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Outstanding</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.debts.map(debt => `
                                    <tr>
                                        <td>#${debt.id}</td>
                                        <td><strong>${debt.customer_name}</strong><br><small>${debt.customer_phone}</small></td>
                                        <td>${this.formatCurrency(debt.total_amount)}</td>
                                        <td class="amount-positive">${this.formatCurrency(debt.paid_amount)}</td>
                                        <td class="${debt.remaining_amount > 0 ? 'amount-negative' : 'amount-positive'}">
                                            ${this.formatCurrency(debt.remaining_amount)}
                                        </td>
                                        <td>${this.formatDate(debt.due_date)}</td>
                                        <td><span class="status-badge ${debt.status}">${this.formatStatus(debt.status)}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="report-footer">
                        <p>Report generated on ${new Date().toLocaleString()}</p>
                        <p>NurBuild Management System - Building Materials & Construction Supplies</p>
                    </div>
                    
                    <div class="print-controls">
                        <button class="btn-print" onclick="window.print()">🖨️ Print Report</button>
                        <button class="btn-close" onclick="debtManager.closePrintableReport()">❌ Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing report if any
        this.closePrintableReport();
        
        // Add to page
        document.body.insertAdjacentHTML('beforeend', reportHTML);
    }
    
    // Render printable customer debt report
    renderPrintableCustomerReport(data) {
        const reportHTML = `
            <div class="print-report show" id="printableReport">
                <div class="print-content">
                    <div class="company-header">
                        <h1 class="company-name">NurBuild Management System</h1>
                        <p class="company-subtitle">Building Materials & Construction Supplies</p>
                        <h2 class="report-title">Customer Debt Report</h2>
                        <p class="report-date">Generated on ${new Date().toLocaleDateString('en-US', { 
                            year: 'numeric', month: 'long', day: 'numeric' 
                        })}</p>
                    </div>
                    
                    <div class="customer-info">
                        <h3>Customer Information</h3>
                        <div class="customer-details">
                            <div class="customer-detail"><strong>Name:</strong> ${data.customer?.name || 'N/A'}</div>
                            <div class="customer-detail"><strong>Phone:</strong> ${data.customer?.phone || 'N/A'}</div>
                            <div class="customer-detail"><strong>Email:</strong> ${data.customer?.email || 'N/A'}</div>
                            <div class="customer-detail"><strong>Type:</strong> ${data.customer?.customer_type || 'N/A'}</div>
                            <div class="customer-detail"><strong>Credit Limit:</strong> ${this.formatCurrency(data.customer?.credit_limit || 0)}</div>
                            <div class="customer-detail"><strong>Outstanding Balance:</strong> 
                                <span class="${data.customer?.outstanding_balance > 0 ? 'amount-negative' : 'amount-positive'}">
                                    ${this.formatCurrency(data.customer?.outstanding_balance || 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="summary-section">
                        <h3 class="section-header">Debt Summary</h3>
                        <div class="summary-cards">
                            <div class="summary-card">
                                <h4>Total Debts</h4>
                                <div class="amount">${data.summary?.total_debts || 0}</div>
                            </div>
                            <div class="summary-card">
                                <h4>Total Amount</h4>
                                <div class="amount">${this.formatCurrency(data.summary?.total_amount || 0)}</div>
                            </div>
                            <div class="summary-card paid">
                                <h4>Total Paid</h4>
                                <div class="amount">${this.formatCurrency(data.summary?.total_paid || 0)}</div>
                            </div>
                            <div class="summary-card outstanding">
                                <h4>Outstanding</h4>
                                <div class="amount">${this.formatCurrency(data.summary?.total_outstanding || 0)}</div>
                            </div>
                        </div>
                    </div>
                    
                    ${data.debts && data.debts.length > 0 ? `
                    <div class="debts-section">
                        <h3 class="section-header">Debt Records</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Date</th>
                                    <th>Due Date</th>
                                    <th>Total Amount</th>
                                    <th>Paid Amount</th>
                                    <th>Outstanding</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.debts.map(debt => `
                                    <tr>
                                        <td>#${debt.id}</td>
                                        <td>${this.formatDate(debt.created_date)}</td>
                                        <td>${this.formatDate(debt.due_date)}</td>
                                        <td>${this.formatCurrency(debt.total_amount)}</td>
                                        <td class="amount-positive">${this.formatCurrency(debt.paid_amount)}</td>
                                        <td class="${debt.remaining_amount > 0 ? 'amount-negative' : 'amount-positive'}">
                                            ${this.formatCurrency(debt.remaining_amount)}
                                        </td>
                                        <td><span class="status-badge ${debt.status}">${debt.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : '<p>No debts found for this customer.</p>'}
                    
                    ${data.materials && data.materials.length > 0 ? `
                    <div class="materials-section">
                        <h3 class="section-header">Materials Summary</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>SKU</th>
                                    <th>Quantity</th>
                                    <th>Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.materials.map(material => `
                                    <tr>
                                        <td><strong>${material.name}</strong></td>
                                        <td>${material.sku}</td>
                                        <td>${material.quantity}</td>
                                        <td>${this.formatCurrency(material.total_value)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}
                    
                    <div class="report-footer">
                        <p>Report generated on ${new Date().toLocaleString()}</p>
                        <p>NurBuild Management System - Customer: ${data.customer?.name || 'Unknown'}</p>
                    </div>
                    
                    <div class="print-controls">
                        <button class="btn-print" onclick="window.print()">🖨️ Print Report</button>
                        <button class="btn-close" onclick="debtManager.closePrintableReport()">❌ Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing report if any
        this.closePrintableReport();
        
        // Add to page
        document.body.insertAdjacentHTML('beforeend', reportHTML);
    }
    
    // Render printable individual debt statement
    renderPrintableDebtStatement(debt, materialsData) {
        const reportHTML = `
            <div class="print-report show" id="printableReport">
                <div class="print-content">
                    <div class="company-header">
                        <h1 class="company-name">NurBuild Management System</h1>
                        <p class="company-subtitle">Building Materials & Construction Supplies</p>
                        <h2 class="report-title">Debt Statement #${debt.id}</h2>
                        <p class="report-date">Generated on ${new Date().toLocaleDateString('en-US', { 
                            year: 'numeric', month: 'long', day: 'numeric' 
                        })}</p>
                    </div>
                    
                    <div class="customer-info">
                        <h3>Customer Information</h3>
                        <div class="customer-details">
                            <div class="customer-detail"><strong>Name:</strong> ${debt.customer_name}</div>
                            <div class="customer-detail"><strong>Phone:</strong> ${debt.customer_phone}</div>
                            <div class="customer-detail"><strong>Debt ID:</strong> #${debt.id}</div>
                            <div class="customer-detail"><strong>Created:</strong> ${this.formatDate(debt.created_at)}</div>
                            <div class="customer-detail"><strong>Due Date:</strong> ${this.formatDate(debt.due_date)}</div>
                            <div class="customer-detail"><strong>Status:</strong> 
                                <span class="status-badge ${debt.status}">${this.formatStatus(debt.status)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="summary-section">
                        <h3 class="section-header">Debt Summary</h3>
                        <div class="summary-cards">
                            <div class="summary-card">
                                <h4>Total Amount</h4>
                                <div class="amount">${this.formatCurrency(debt.total_amount)}</div>
                            </div>
                            <div class="summary-card paid">
                                <h4>Paid Amount</h4>
                                <div class="amount">${this.formatCurrency(debt.paid_amount)}</div>
                            </div>
                            <div class="summary-card outstanding">
                                <h4>Outstanding</h4>
                                <div class="amount">${this.formatCurrency(debt.remaining_amount)}</div>
                            </div>
                            <div class="summary-card">
                                <h4>Priority</h4>
                                <div class="amount">${debt.priority}</div>
                            </div>
                        </div>
                    </div>
                    
                    ${materialsData.materials && materialsData.materials.length > 0 ? `
                    <div class="materials-section">
                        <h3 class="section-header">Materials Breakdown</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>SKU</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${materialsData.materials.map(material => `
                                    <tr>
                                        <td><strong>${material.material_name || 'N/A'}</strong></td>
                                        <td>${material.material_sku || 'N/A'}</td>
                                        <td>${material.quantity || 0} ${material.unit || ''}</td>
                                        <td>${this.formatCurrency(material.price_per_unit || 0)}</td>
                                        <td>${this.formatCurrency(material.total_value || 0)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}
                    
                    <div class="report-footer">
                        <p>Statement generated on ${new Date().toLocaleString()}</p>
                        <p>NurBuild Management System - Debt #${debt.id}</p>
                        <p><strong>Note:</strong> This statement reflects the debt status as of the generation date.</p>
                    </div>
                    
                    <div class="print-controls">
                        <button class="btn-print" onclick="window.print()">🖨️ Print Statement</button>
                        <button class="btn-close" onclick="debtManager.closePrintableReport()">❌ Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing report if any
        this.closePrintableReport();
        
        // Add to page
        document.body.insertAdjacentHTML('beforeend', reportHTML);
    }
    
    // Close printable report
    closePrintableReport() {
        const existingReport = document.getElementById('printableReport');
        if (existingReport) {
            existingReport.remove();
        }
    }
}

// Initialize the debt manager when the page loads
const debtManager = new DebtManager();

// Make it globally available for onclick handlers
window.debtManager = debtManager;