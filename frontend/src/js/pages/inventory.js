// inventory.js - Optimized Inventory Management System
import apiClient from '../apiClient.js';
import notificationManager from '../utils/notifications.js';

class InventoryManager {
    constructor() {
        this.data = {
            materials: [], categories: [], units: [], adjustments: [],
            currentTab: 'materials', 
            pagination: {
                materials: { page: 1, limit: 6, total: 0 },
                categories: { page: 1, limit: 6, total: 0 },
                units: { page: 1, limit: 6, total: 0 },
                adjustments: { page: 1, limit: 6, total: 0 }
            },
            filters: { search: '', category: '', stock: '', type: '', date: '' }
        };
        this.pendingAction = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.renderCurrentTab();
        this.updateStats();
    }

    setupEventListeners() {
        // Tab navigation
        this.addEventListeners('.tab-btn', 'click', (e) => this.switchTab(e.target.dataset.tab));
        
        // Search handlers
        ['materials', 'categories', 'units', 'adjustments'].forEach(type => {
            this.addEventListeners(`#${type}-search`, 'input', () => this.handleSearch(type));
        });

        // Filter dropdowns
        this.addEventListeners(['#category-filter', '#stock-filter', '#adjustment-type-filter', '#date-filter'], 'change', () => this.applyFilters());

        // Modal and form handlers
        this.setupModalAndFormHandlers();

        // UI controls
        this.addEventListeners('#menuToggle', 'click', () => this.toggleSidebar());
        this.addEventListeners('#logoutBtn', 'click', () => this.logout());
        this.addEventListeners('#low-stock-btn', 'click', () => this.filterLowStock());
    }

    setupModalAndFormHandlers() {
        const modals = ['material', 'category', 'unit', 'adjustment'];
        
        modals.forEach(type => {
            this.addEventListeners(`#add-${type}-btn`, 'click', () => this.openModal(`${type}-modal`));
            this.addEventListeners([`#close-${type}-modal`, `#cancel-${type}`], 'click', () => this.closeModal(`${type}-modal`));
            this.addEventListeners(`#${type}-form`, 'submit', (e) => this.handleFormSubmit(e, type));
        });

        // Confirm modal
        this.addEventListeners('#confirm-yes', 'click', () => this.executeConfirmAction());
        this.addEventListeners(['#close-confirm-modal', '#confirm-no'], 'click', () => this.closeModal('confirm-modal'));
    }

    addEventListeners(selector, event, handler) {
        const elements = typeof selector === 'string' ? 
            (selector.startsWith('#') ? [document.querySelector(selector)] : document.querySelectorAll(selector)) : 
            selector.map(s => document.querySelector(s)).filter(Boolean);
        
        elements.forEach(el => el?.addEventListener(event, handler));
    }

    async loadInitialData() {
        try {
            const promises = [
                this.loadData('categories', '/inventory/categories/'),
                this.loadData('units', '/inventory/units/'),
                this.loadData('materials', '/inventory/materials/'),
                this.loadData('adjustments', '/inventory/stock-adjustments/')
            ];
            await Promise.all(promises);
            await this.populateDropdowns();
        } catch (error) {
            this.showError('Failed to load initial data');
        }
    }

    async loadData(type, endpoint) {
        try {
            // Show loading state
            this.setLoadingState(type, true);
            
            const params = new URLSearchParams({
                page: this.data.pagination[type].page,
                limit: this.data.pagination[type].limit,
                search: this.data.filters.search,
                ...(type === 'materials' && { 
                    category: this.data.filters.category,
                    low_stock: this.data.filters.stock === 'low'
                }),
                ...(type === 'adjustments' && { 
                    adjustment_type: this.data.filters.type 
                })
            });
            
            const url = `${endpoint}?${params}`;
            const response = await apiClient.get(url);
            
            // All endpoints now return paginated responses
            this.data[type] = response.results || [];
            this.data.pagination[type].total = response.count || 0;
            
            if (type === this.data.currentTab) this.renderCurrentTab();
        } catch (error) {
            console.error(`Error loading ${type}:`, error);
            this.showError(`Failed to load ${type}. Please check your connection and try again.`);
            // Clear data on error to prevent stale data display
            this.data[type] = [];
            this.data.pagination[type].total = 0;
            if (type === this.data.currentTab) this.renderCurrentTab();
        } finally {
            this.setLoadingState(type, false);
        }
    }

    renderCurrentTab() {
        const renderers = {
            materials: () => this.renderTable('materials', this.getMaterialRows()),
            categories: () => this.renderTable('categories', this.getCategoryRows()),
            units: () => this.renderTable('units', this.getUnitRows()),
            adjustments: () => this.renderTable('adjustments', this.getAdjustmentRows())
        };
        renderers[this.data.currentTab]?.();
    }

    renderTable(type, rowsHtml) {
        const tbody = document.getElementById(`${type}-table-body`);
        if (tbody) tbody.innerHTML = rowsHtml;
        this.updatePagination(type);
    }

    getMaterialRows() {
        // Data is already paginated from backend
        return this.data.materials.map(m => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="material-avatar">
                            <i class="fas fa-box"></i>
                        </div>
                        <div class="ms-3">
                            <h6 class="mb-0">${m.name}</h6>
                            <small class="text-muted">${m.category_name}</small>
                        </div>
                    </div>
                </td>
                <td>${m.category_name}</td>
                <td><span class="stock-info ${m.is_low_stock ? 'low-stock' : ''}">${m.quantity_in_stock} ${m.unit_abbreviation}</span></td>
                <td>$${parseFloat(m.price_per_unit).toFixed(2)}</td>
                <td>$${parseFloat(m.stock_value).toFixed(2)}</td>
                <td><span class="badge ${m.is_low_stock ? 'badge-warning' : 'badge-success'}">${m.is_low_stock ? 'Low Stock' : 'In Stock'}</span></td>
                <td>${this.getActionButtons('material', m.id)}</td>
            </tr>
        `).join('');
    }

    getCategoryRows() {
        // Data is already paginated from backend
        return this.data.categories.map(c => `
            <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.description || '-'}</td>
                <td>${c.parent_name || 'Root Category'}</td>
                <td><span class="badge ${c.is_active ? 'badge-success' : 'badge-secondary'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td>${this.getActionButtons('category', c.id)}</td>
            </tr>
        `).join('');
    }

    getUnitRows() {
        // Data is already paginated from backend
        return this.data.units.map(u => `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td><span class="badge badge-info">${u.abbreviation}</span></td>
                <td>${u.description || '-'}</td>
                <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-secondary'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${this.getActionButtons('unit', u.id)}</td>
            </tr>
        `).join('');
    }

    getAdjustmentRows() {
        // Data is already paginated from backend
        return this.data.adjustments.map(a => `
            <tr>
                <td>${new Date(a.date).toLocaleDateString()}</td>
                <td>${a.material_name}</td>
                <td><span class="badge badge-${this.getAdjustmentBadgeClass(a.adjustment_type)}">${a.adjustment_type.charAt(0).toUpperCase() + a.adjustment_type.slice(1)}</span></td>
                <td><span class="${['outgoing', 'loss'].includes(a.adjustment_type) ? 'text-danger' : 'text-success'}">
                    ${['outgoing', 'loss'].includes(a.adjustment_type) ? '-' : '+'}${a.quantity} ${a.unit_abbreviation}</span></td>
                <td title="${a.reason}">${a.reason.length > 30 ? a.reason.substring(0, 30) + '...' : a.reason}</td>
                <td>${a.performer_name || 'System'}</td>
                <td><button class="btn btn-sm btn-info" onclick="inventoryManager.viewAdjustment(${a.id})"><i class="fas fa-eye"></i></button></td>
            </tr>
        `).join('');
    }

    getActionButtons(type, id) {
        return `<div class="action-buttons">
            <button class="btn btn-sm btn-warning" onclick="inventoryManager.edit${type.charAt(0).toUpperCase() + type.slice(1)}(${id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="inventoryManager.delete${type.charAt(0).toUpperCase() + type.slice(1)}(${id})"><i class="fas fa-trash"></i></button>
        </div>`;
    }

    async handleFormSubmit(e, type) {
        e.preventDefault();
        try {
            const formData = this.getFormData(`${type}-form`);
            const isEdit = formData.id;
            const endpoint = `/inventory/${type === 'material' ? 'materials' : type === 'category' ? 'categories' : type === 'unit' ? 'units' : 'stock-adjustments'}/`;
            
            if (isEdit && type !== 'adjustment') {
                await apiClient.put(`${endpoint}${formData.id}/`, formData);
                this.showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully`);
            } else {
                await apiClient.post(endpoint, formData);
                this.showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} ${type === 'adjustment' ? 'recorded' : 'added'} successfully`);
            }

            this.closeModal(`${type}-modal`);
            await this.refreshData(type);
            if (['material', 'adjustment'].includes(type)) this.updateStats();
        } catch (error) {
            this.showError(error.message || `Failed to save ${type}`);
        }
    }

    async refreshData(type) {
        if (type === 'material') {
            await this.loadData('materials', '/inventory/materials/');
        } else if (type === 'category') {
            await this.loadData('categories', '/inventory/categories/');
            await this.populateDropdowns();
        } else if (type === 'unit') {
            await this.loadData('units', '/inventory/units/');
            await this.populateDropdowns();
        } else if (type === 'adjustment') {
            await Promise.all([
                this.loadData('adjustments', '/inventory/stock-adjustments/'),
                this.loadData('materials', '/inventory/materials/')
            ]);
        }
    }

    // Fixed generic edit method with proper data structure mapping
    async editItem(type, id) {
        // Map type to correct data array key
        const dataKeyMap = {
            material: 'materials',
            category: 'categories', 
            unit: 'units'
        };
        
        const dataKey = dataKeyMap[type];
        const item = this.data[dataKey]?.find(i => i.id === id);
        
        if (!item) {
            console.error(`Item not found: ${type} with id ${id}`);
            this.showError(`${type.charAt(0).toUpperCase() + type.slice(1)} not found`);
            return;
        }

        this.populateForm(`${type}-form`, item);
        const modalTitle = document.getElementById(`${type}-modal-title`);
        if (modalTitle) {
            modalTitle.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        }
        this.openModal(`${type}-modal`);
    }

    // Fixed generic delete method with proper data structure mapping
    async deleteItem(type, id) {
        this.confirmAction(`Are you sure you want to delete this ${type}?`, async () => {
            try {
                const endpoint = `/inventory/${type === 'material' ? 'materials' : type === 'category' ? 'categories' : 'units'}/${id}/`;
                await apiClient.delete(endpoint);
                
                // Map type to correct data array key and remove from local data
                const dataKeyMap = {
                    material: 'materials',
                    category: 'categories', 
                    unit: 'units'
                };
                
                const dataKey = dataKeyMap[type];
                this.data[dataKey] = this.data[dataKey].filter(item => item.id !== id);
                
                this.showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
                this.renderCurrentTab();
                if (type === 'material') this.updateStats();
                if (['category', 'unit'].includes(type)) this.populateDropdowns();
            } catch (error) {
                this.showError(`Failed to delete ${type}`);
                // Reload data on error to ensure consistency
                await this.refreshData(type);
            }
        });
    }

    // Public methods for onclick handlers
    editMaterial(id) { this.editItem('material', id); }
    editCategory(id) { this.editItem('category', id); }
    editUnit(id) { this.editItem('unit', id); }
    deleteMaterial(id) { this.deleteItem('material', id); }
    deleteCategory(id) { this.deleteItem('category', id); }
    deleteUnit(id) { this.deleteItem('unit', id); }

    async updateStats() {
        try {
            // Get actual counts from paginated endpoints to ensure synchronization
            const [stockValue, lowStockItems, allMaterials, allCategories] = await Promise.all([
                apiClient.get('/inventory/materials/stock_value/'),
                apiClient.get('/inventory/materials/low_stock/'),
                apiClient.get('/inventory/materials/?page=1&limit=1'), // Just need count
                apiClient.get('/inventory/categories/?page=1&limit=1') // Just need count
            ]);

            const stats = {
                'total-materials': allMaterials.count || 0,
                'stock-value': `$${parseFloat(stockValue.total_stock_value || 0).toFixed(2)}`,
                'low-stock-count': lowStockItems.length || lowStockItems.count || 0,
                'categories-count': allCategories.count || 0
            };

            Object.entries(stats).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    async populateDropdowns() {
        try {
            // Load all categories and units for dropdowns (not paginated for this purpose)
            const [allCategories, allUnits, allMaterials] = await Promise.all([
                apiClient.get('/inventory/categories/?limit=1000'), // Get many items for dropdown
                apiClient.get('/inventory/units/?limit=1000'),
                apiClient.get('/inventory/materials/?limit=1000')
            ]);

            const dropdowns = {
                'material-category': { options: allCategories.results || [], default: 'Select Category', valueKey: 'id', textKey: 'name' },
                'category-filter': { options: allCategories.results || [], default: 'All Categories', valueKey: 'id', textKey: 'name' },
                'category-parent': { options: allCategories.results || [], default: 'None (Root Category)', valueKey: 'id', textKey: 'name' },
                'material-unit': { options: allUnits.results || [], default: 'Select Unit', valueKey: 'id', textKey: (u) => `${u.name} (${u.abbreviation})` },
                'adjustment-material': { options: allMaterials.results || [], default: 'Select Material', valueKey: 'id', textKey: (m) => m.name }
            };

            Object.entries(dropdowns).forEach(([id, config]) => {
                const select = document.getElementById(id);
                if (!select) return;
                
                const currentValue = select.value;
                select.innerHTML = `<option value="">${config.default}</option>`;
                
                config.options.forEach(item => {
                    const text = typeof config.textKey === 'function' ? config.textKey(item) : item[config.textKey];
                    select.innerHTML += `<option value="${item[config.valueKey]}">${text}</option>`;
                });
                
                select.value = currentValue;
            });
        } catch (error) {
            console.error('Failed to populate dropdowns:', error);
        }
    }

    getFormData(formId) {
        const formMappings = {
            'material-form': {
                fields: ['name', 'description', 'category', 'unit', 'quantity_in_stock:material-stock', 'reorder_level:material-reorder-level', 'reorder_quantity:material-reorder-qty', 'cost_per_unit:material-cost', 'price_per_unit:material-price'],
                prefix: 'material-'
            },
            'category-form': {
                fields: ['name', 'description', 'parent'],
                prefix: 'category-'
            },
            'unit-form': {
                fields: ['name', 'abbreviation', 'description'],
                prefix: 'unit-'
            },
            'adjustment-form': {
                fields: ['material:adjustment-material', 'adjustment_type:adjustment-type', 'quantity:adjustment-quantity', 'reason:adjustment-reason', 'reference:adjustment-reference'],
                prefix: 'adjustment-'
            }
        };

        const config = formMappings[formId];
        const data = {};

        config.fields.forEach(field => {
            const [dataKey, inputId] = field.includes(':') ? field.split(':') : [field, `${config.prefix}${field}`];
            const value = document.getElementById(inputId)?.value?.trim();
            if (value) data[dataKey] = value;
        });

        // Handle ID for edits
        const form = document.getElementById(formId);
        const idInput = form?.querySelector('input[name="id"]');
        if (idInput?.value) data.id = idInput.value;

        return data;
    }

    populateForm(formId, data) {
        const mappings = {
            'material-form': { name: 'material-name', description: 'material-description', category: 'material-category', unit: 'material-unit', quantity_in_stock: 'material-stock', reorder_level: 'material-reorder-level', reorder_quantity: 'material-reorder-qty', cost_per_unit: 'material-cost', price_per_unit: 'material-price' },
            'category-form': { name: 'category-name', description: 'category-description', parent: 'category-parent' },
            'unit-form': { name: 'unit-name', abbreviation: 'unit-abbreviation', description: 'unit-description' }
        };

        const mapping = mappings[formId];
        const form = document.getElementById(formId);

        if (!mapping || !form) {
            console.error(`Form mapping or form not found for: ${formId}`);
            return;
        }

        // Clear form first
        form.reset();

        Object.entries(data).forEach(([key, value]) => {
            const inputId = mapping[key];
            if (inputId) {
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = value || '';
                } else {
                    console.warn(`Input not found for field: ${key} (${inputId})`);
                }
            }
        });

        // Add/update hidden ID field
        let idInput = form.querySelector('input[name="id"]');
        if (!idInput) {
            idInput = document.createElement('input');
            idInput.type = 'hidden';
            idInput.name = 'id';
            form.appendChild(idInput);
        }
        idInput.value = data.id;
    }

    // Utility methods
    switchTab(tab) {
        this.data.currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === `${tab}-tab`));
        this.renderCurrentTab();
    }

    handleSearch(type) {
        this.data.filters.search = document.getElementById(`${type}-search`).value;
        // Reset to first page when searching
        this.data.pagination[type].page = 1;
        
        // All data types now use backend pagination
        const endpoints = {
            materials: '/inventory/materials/',
            categories: '/inventory/categories/',
            units: '/inventory/units/',
            adjustments: '/inventory/stock-adjustments/'
        };
        
        this.loadData(type, endpoints[type]);
    }

    applyFilters() {
        Object.assign(this.data.filters, {
            category: document.getElementById('category-filter')?.value || '',
            stock: document.getElementById('stock-filter')?.value || '',
            type: document.getElementById('adjustment-type-filter')?.value || '',
            date: document.getElementById('date-filter')?.value || ''
        });

        // Reset to first page when applying filters
        this.data.pagination[this.data.currentTab].page = 1;

        if (this.data.currentTab === 'materials') this.loadData('materials', '/inventory/materials/');
        else if (this.data.currentTab === 'adjustments') this.loadData('adjustments', '/inventory/stock-adjustments/');
    }

    filterLowStock() {
        this.data.filters.stock = 'low';
        this.data.pagination.materials.page = 1;
        this.loadData('materials', '/inventory/materials/');
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'flex';
        } else {
            console.error(`Modal not found: ${modalId}`);
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
                form.querySelector('input[name="id"]')?.remove();
            }
        }
    }

    confirmAction(message, action) {
        const confirmMessage = document.getElementById('confirm-message');
        if (confirmMessage) {
            confirmMessage.textContent = message;
        }
        this.pendingAction = action;
        this.openModal('confirm-modal');
    }

    executeConfirmAction() {
        if (this.pendingAction) {
            this.pendingAction();
            this.pendingAction = null;
        }
        this.closeModal('confirm-modal');
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

    showAlert(message, type) {
        // Map Bootstrap alert types to notification types
        const typeMap = {
            'success': 'success',
            'danger': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        notificationManager.showNotification(message, typeMap[type] || 'info');
    }

    getAdjustmentBadgeClass(type) {
        return { incoming: 'success', outgoing: 'warning', loss: 'danger', return: 'info', correction: 'secondary' }[type] || 'secondary';
    }

    setLoadingState(type, isLoading) {
        const tableBody = document.getElementById(`${type}-table-body`);
        if (tableBody) {
            if (isLoading) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="100%" class="text-center py-4">
                            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                            Loading ${type}...
                        </td>
                    </tr>
                `;
            }
        }

        // Disable pagination buttons during loading
        const pagination = document.getElementById(`${type}-pagination`);
        if (pagination) {
            const buttons = pagination.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = isLoading);
        }
    }

    updatePagination(type) {
        const pagination = this.data.pagination[type];
        const paginationContainer = document.getElementById(`${type}-pagination`);
        
        // Generate pagination buttons
        if (paginationContainer) {
            const totalPages = Math.ceil(pagination.total / pagination.limit);
            let buttonsHtml = '';
            
            // Previous button
            const prevDisabled = pagination.page <= 1 ? 'disabled' : '';
            buttonsHtml += `<button class="pagination-btn" ${prevDisabled} onclick="inventoryManager.changePage('${type}', -1)">
                <i class="fas fa-chevron-left"></i>
            </button>`;
            
            // Page info
            buttonsHtml += `<span id="pageInfo">Page ${pagination.page} of ${totalPages}</span>`;
            
            // Next button
            const nextDisabled = pagination.page >= totalPages ? 'disabled' : '';
            buttonsHtml += `<button class="pagination-btn" ${nextDisabled} onclick="inventoryManager.changePage('${type}', 1)">
                <i class="fas fa-chevron-right"></i>
            </button>`;
            
            paginationContainer.innerHTML = buttonsHtml;
        }
    }

    changePage(type, direction) {
        const pagination = this.data.pagination[type];
        const totalPages = Math.ceil(pagination.total / pagination.limit);
        const newPage = pagination.page + direction;
        
        if (newPage >= 1 && newPage <= totalPages) {
            pagination.page = newPage;
            
            // All data types now use backend pagination
            const endpoints = {
                materials: '/inventory/materials/',
                categories: '/inventory/categories/',
                units: '/inventory/units/',
                adjustments: '/inventory/stock-adjustments/'
            };
            
            this.loadData(type, endpoints[type]);
        }
    }

    toggleSidebar() {
        ['sidebar', 'mainContent'].forEach(id => document.getElementById(id)?.classList.toggle(id === 'sidebar' ? 'collapsed' : 'expanded'));
    }

    logout() {
        ['token', 'refreshToken'].forEach(key => localStorage.removeItem(key));
        window.location.href = 'index.html';
    }

    viewAdjustment(id) {
        const adj = this.data.adjustments.find(a => a.id === id);
        if (adj) {
            alert(`Adjustment Details:\n\nMaterial: ${adj.material_name}\nType: ${adj.adjustment_type}\nQuantity: ${adj.quantity}\nReason: ${adj.reason}\nDate: ${new Date(adj.date).toLocaleString()}`);
        }
    }
}

// Initialize and export
const inventoryManager = new InventoryManager();
window.inventoryManager = inventoryManager;
export default inventoryManager;