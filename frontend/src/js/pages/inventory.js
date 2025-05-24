import { authFetch, handleLogout } from "../_utils.js";

// Initialize logout handler
handleLogout();

// API Configuration
const API_BASE = "/api/inventory";
const MATERIALS_API = `${API_BASE}/materials/`;
const CATEGORIES_API = `${API_BASE}/categories/`;
const UNITS_API = `${API_BASE}/units/`;
const STOCK_ADJUSTMENTS_API = `${API_BASE}/stock-adjustments/`;

// DOM Elements
const tableBody = document.querySelector("#materialsTable tbody");
const form = document.getElementById("materialForm");
const modalEl = document.getElementById("materialModal");
const stockModalEl = document.getElementById("stockAdjustmentModal");
const filterForm = document.getElementById("filterForm");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importFileInput");
const refreshBtn = document.getElementById("refreshBtn");

// Modal instances
const modal = new bootstrap.Modal(modalEl);
const stockModal = new bootstrap.Modal(stockModalEl);

// Application State
let currentMaterials = [];
let categories = [];
let units = [];
let currentFilters = {};
let currentPage = 1;
const itemsPerPage = 25;

// Utility Functions
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

const formatNumber = (number, decimals = 2) => {
    return Number(number).toFixed(decimals);
};

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show notification-toast`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
};

const showLoading = (show = true) => {
    const loader = document.getElementById('loadingSpinner');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
};

// Data Loading Functions
const loadCategories = async () => {
    try {
        const data = await authFetch(CATEGORIES_API);
        categories = data.results || data;
        populateCategoryDropdown();
    } catch (error) {
        console.error('Error loading categories:', error);
        showNotification('Failed to load categories', 'danger');
    }
};

const loadUnits = async () => {
    try {
        const data = await authFetch(UNITS_API);
        units = data.results || data;
        populateUnitDropdown();
    } catch (error) {
        console.error('Error loading units:', error);
        showNotification('Failed to load units', 'danger');
    }
};

const loadMaterials = async (page = 1, filters = {}) => {
    try {
        showLoading(true);
        
        // Build query parameters
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: itemsPerPage.toString(),
            ...filters
        });
        
        const data = await authFetch(`${MATERIALS_API}?${params}`);
        currentMaterials = data.results || data;
        
        renderMaterialsTable();
        renderPagination(data);
        updateStatistics();
        
    } catch (error) {
        console.error('Error loading materials:', error);
        showNotification('Failed to load materials', 'danger');
    } finally {
        showLoading(false);
    }
};

// Dropdown Population
const populateCategoryDropdown = () => {
    const categorySelect = document.getElementById('mCategory');
    const filterCategorySelect = document.getElementById('filterCategory');
    
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    
    if (filterCategorySelect) {
        filterCategorySelect.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(cat => {
            filterCategorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
};

const populateUnitDropdown = () => {
    const unitSelect = document.getElementById('mUnit');
    
    if (unitSelect) {
        unitSelect.innerHTML = '<option value="">Select Unit</option>';
        units.forEach(unit => {
            unitSelect.innerHTML += `<option value="${unit.id}">${unit.name} (${unit.abbreviation})</option>`;
        });
    }
};

// Table Rendering
const renderMaterialsTable = () => {
    if (!tableBody) return;
    
    if (currentMaterials.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <p>No materials found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = currentMaterials.map(material => {
        const stockStatus = getStockStatus(material);
        const categoryName = categories.find(cat => cat.id === material.category)?.name || 'N/A';
        const unitName = units.find(unit => unit.id === material.unit)?.abbreviation || 'N/A';
        
        return `
            <tr class="material-row ${stockStatus.class}" data-id="${material.id}">
                <td>
                    <div class="material-info">
                        <strong>${escapeHtml(material.name)}</strong>
                        <small class="text-muted d-block">SKU: ${escapeHtml(material.sku || 'N/A')}</small>
                    </div>
                </td>
                <td>
                    <span class="category-badge">${escapeHtml(categoryName)}</span>
                </td>
                <td>${escapeHtml(unitName)}</td>
                <td>
                    <div class="stock-info">
                        <span class="stock-quantity ${stockStatus.class}">${formatNumber(material.quantity_in_stock)}</span>
                        <div class="stock-indicator">
                            <div class="stock-bar">
                                <div class="stock-fill ${stockStatus.class}" style="width: ${getStockPercentage(material)}%"></div>
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="reorder-level">${formatNumber(material.reorder_level)}</span>
                    ${material.is_low_stock ? '<i class="fas fa-exclamation-triangle text-warning ms-1" title="Low Stock"></i>' : ''}
                </td>
                <td class="text-end">${formatCurrency(material.price_per_unit)}</td>
                <td class="text-end">${formatCurrency(material.stock_value || 0)}</td>
                <td>${escapeHtml(material.main_supplier_name || 'N/A')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${material.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success stock-btn" data-id="${material.id}" title="Adjust Stock">
                            <i class="fas fa-warehouse"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info view-btn" data-id="${material.id}" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${material.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// Stock Status Helper
const getStockStatus = (material) => {
    const stock = parseFloat(material.quantity_in_stock);
    const reorder = parseFloat(material.reorder_level);
    
    if (stock === 0) {
        return { class: 'out-of-stock', text: 'Out of Stock' };
    } else if (stock <= reorder) {
        return { class: 'low-stock', text: 'Low Stock' };
    } else if (stock <= reorder * 1.5) {
        return { class: 'moderate-stock', text: 'Moderate Stock' };
    } else {
        return { class: 'good-stock', text: 'Good Stock' };
    }
};

const getStockPercentage = (material) => {
    const stock = parseFloat(material.quantity_in_stock);
    const reorder = parseFloat(material.reorder_level);
    const maxStock = reorder * 3; // Assume 3x reorder level as max for visualization
    
    return Math.min((stock / maxStock) * 100, 100);
};

// Pagination
const renderPagination = (data) => {
    const paginationEl = document.getElementById('pagination');
    if (!paginationEl || !data.count) return;
    
    const totalPages = Math.ceil(data.count / itemsPerPage);
    const currentPageNum = currentPage;
    
    let paginationHtml = '';
    
    // Previous button
    paginationHtml += `
        <li class="page-item ${currentPageNum === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPageNum - 1}">Previous</a>
        </li>
    `;
    
    // Page numbers
    const startPage = Math.max(1, currentPageNum - 2);
    const endPage = Math.min(totalPages, currentPageNum + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `
            <li class="page-item ${i === currentPageNum ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    // Next button
    paginationHtml += `
        <li class="page-item ${currentPageNum === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPageNum + 1}">Next</a>
        </li>
    `;
    
    paginationEl.innerHTML = paginationHtml;
};

// Statistics Update
const updateStatistics = () => {
    if (currentMaterials.length === 0) return;
    
    const stats = {
        total: currentMaterials.length,
        lowStock: currentMaterials.filter(m => m.is_low_stock).length,
        outOfStock: currentMaterials.filter(m => m.quantity_in_stock === 0).length,
        totalValue: currentMaterials.reduce((sum, m) => sum + (m.stock_value || 0), 0)
    };
    
    // Update statistics display
    const totalMaterialsEl = document.getElementById('totalMaterials');
    const lowStockEl = document.getElementById('lowStockCount');
    const outOfStockEl = document.getElementById('outOfStockCount');
    const totalValueEl = document.getElementById('totalStockValue');
    
    if (totalMaterialsEl) totalMaterialsEl.textContent = stats.total;
    if (lowStockEl) lowStockEl.textContent = stats.lowStock;
    if (outOfStockEl) outOfStockEl.textContent = stats.outOfStock;
    if (totalValueEl) totalValueEl.textContent = formatCurrency(stats.totalValue);
};

// CRUD Operations
const editMaterial = async (id) => {
    try {
        showLoading(true);
        const material = await authFetch(`${MATERIALS_API}${id}/`);
        
        // Populate form
        form.materialId.value = id;
        form.mName.value = material.name;
        form.mSku.value = material.sku || '';
        form.mDescription.value = material.description || '';
        form.mCategory.value = material.category;
        form.mBrand.value = material.brand || '';
        form.mUnit.value = material.unit;
        form.mStock.value = material.quantity_in_stock;
        form.mReorder.value = material.reorder_level;
        form.mReorderQty.value = material.reorder_quantity || '';
        form.mPrice.value = material.price_per_unit;
        form.mCost.value = material.cost_per_unit;
        form.mSupplier.value = material.main_supplier || '';
        form.mBarcode.value = material.barcode || '';
        
        document.querySelector('#materialModal .modal-title').textContent = 'Edit Material';
        modal.show();
        
    } catch (error) {
        console.error('Error loading material:', error);
        showNotification('Failed to load material details', 'danger');
    } finally {
        showLoading(false);
    }
};

const deleteMaterial = async (id) => {
    const material = currentMaterials.find(m => m.id == id);
    if (!material) return;
    
    const confirmed = await showConfirmDialog(
        'Delete Material',
        `Are you sure you want to delete "${material.name}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
        showLoading(true);
        await authFetch(`${MATERIALS_API}${id}/`, { method: "DELETE" });
        showNotification('Material deleted successfully');
        loadMaterials(currentPage, currentFilters);
    } catch (error) {
        console.error('Error deleting material:', error);
        showNotification('Failed to delete material', 'danger');
    } finally {
        showLoading(false);
    }
};

const saveMaterial = async (formData) => {
    const id = formData.get('materialId');
    
    const payload = {
        name: formData.get('mName'),
        sku: formData.get('mSku'),
        description: formData.get('mDescription'),
        category: parseInt(formData.get('mCategory')),
        brand: formData.get('mBrand'),
        unit: parseInt(formData.get('mUnit')),
        quantity_in_stock: parseFloat(formData.get('mStock')),
        reorder_level: parseFloat(formData.get('mReorder')),
        reorder_quantity: parseFloat(formData.get('mReorderQty')) || 0,
        price_per_unit: parseFloat(formData.get('mPrice')),
        cost_per_unit: parseFloat(formData.get('mCost')),
        main_supplier: parseInt(formData.get('mSupplier')) || null,
        barcode: formData.get('mBarcode'),
    };
    
    const options = {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    };
    
    const url = id ? `${MATERIALS_API}${id}/` : MATERIALS_API;
    
    try {
        showLoading(true);
        await authFetch(url, options);
        showNotification(`Material ${id ? 'updated' : 'created'} successfully`);
        modal.hide();
        loadMaterials(currentPage, currentFilters);
    } catch (error) {
        console.error('Error saving material:', error);
        showNotification(`Failed to ${id ? 'update' : 'create'} material`, 'danger');
        throw error;
    } finally {
        showLoading(false);
    }
};

// Stock Adjustment
const openStockAdjustment = async (materialId) => {
    const material = currentMaterials.find(m => m.id == materialId);
    if (!material) return;
    
    document.getElementById('stockMaterialName').textContent = material.name;
    document.getElementById('stockCurrentQuantity').textContent = formatNumber(material.quantity_in_stock);
    document.getElementById('stockMaterialId').value = materialId;
    document.getElementById('stockAdjustmentForm').reset();
    
    stockModal.show();
};

const saveStockAdjustment = async (formData) => {
    const payload = {
        material: parseInt(formData.get('materialId')),
        adjustment_type: formData.get('adjustmentType'),
        quantity: parseFloat(formData.get('quantity')),
        reason: formData.get('reason'),
        reference: formData.get('reference') || null,
    };
    
    try {
        showLoading(true);
        await authFetch(STOCK_ADJUSTMENTS_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        
        showNotification('Stock adjustment saved successfully');
        stockModal.hide();
        loadMaterials(currentPage, currentFilters);
        
    } catch (error) {
        console.error('Error saving stock adjustment:', error);
        const errorMsg = error.message || 'Failed to save stock adjustment';
        showNotification(errorMsg, 'danger');
        throw error;
    } finally {
        showLoading(false);
    }
};

// Utility Functions
const escapeHtml = (text) => {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
};

const showConfirmDialog = (title, message) => {
    return new Promise((resolve) => {
        if (confirm(`${title}\n\n${message}`)) {
            resolve(true);
        } else {
            resolve(false);
        }
    });
};

// Search and Filter
const handleSearch = debounce((searchTerm) => {
    currentFilters.search = searchTerm;
    currentPage = 1;
    loadMaterials(currentPage, currentFilters);
}, 300);

const applyFilters = () => {
    const formData = new FormData(filterForm);
    currentFilters = {};
    
    for (let [key, value] of formData.entries()) {
        if (value) {
            currentFilters[key] = value;
        }
    }
    
    currentPage = 1;
    loadMaterials(currentPage, currentFilters);
};

const clearFilters = () => {
    filterForm.reset();
    searchInput.value = '';
    currentFilters = {};
    currentPage = 1;
    loadMaterials(currentPage, currentFilters);
};

// Export/Import Functions
const exportMaterials = async () => {
    try {
        showLoading(true);
        const allMaterials = await authFetch(`${MATERIALS_API}?page_size=1000`);
        
        const csvContent = convertToCSV(allMaterials.results || allMaterials);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `materials_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        window.URL.revokeObjectURL(url);
        showNotification('Materials exported successfully');
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export materials', 'danger');
    } finally {
        showLoading(false);
    }
};

const convertToCSV = (data) => {
    const headers = [
        'Name', 'SKU', 'Category', 'Unit', 'Stock', 'Reorder Level',
        'Price per Unit', 'Cost per Unit', 'Supplier', 'Brand', 'Barcode'
    ];
    
    const rows = data.map(material => [
        material.name,
        material.sku || '',
        material.category_name || '',
        material.unit_name || '',
        material.quantity_in_stock,
        material.reorder_level,
        material.price_per_unit,
        material.cost_per_unit,
        material.main_supplier_name || '',
        material.brand || '',
        material.barcode || ''
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    return csvContent;
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Table click events
    if (tableBody) {
        tableBody.addEventListener("click", (e) => {
            const id = e.target.closest('button')?.dataset.id;
            if (!id) return;
            
            if (e.target.closest('.edit-btn')) {
                editMaterial(id);
            } else if (e.target.closest('.delete-btn')) {
                deleteMaterial(id);
            } else if (e.target.closest('.stock-btn')) {
                openStockAdjustment(id);
            } else if (e.target.closest('.view-btn')) {
                // TODO: Implement view details modal
                showNotification('View details feature coming soon', 'info');
            }
        });
    }
    
    // Form submissions
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                await saveMaterial(new FormData(form));
            } catch (error) {
                // Error already handled in saveMaterial
            }
        });
    }
    
    // Stock adjustment form
    const stockForm = document.getElementById('stockAdjustmentForm');
    if (stockForm) {
        stockForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                await saveStockAdjustment(new FormData(stockForm));
            } catch (error) {
                // Error already handled in saveStockAdjustment
            }
        });
    }
    
    // Modal reset
    modalEl?.addEventListener("show.bs.modal", () => {
        form.reset();
        form.materialId.value = "";
        document.querySelector('#materialModal .modal-title').textContent = 'Add Material';
    });
    
    // Search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
    }
    
    // Filter form
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });
        
        // Clear filters button
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearFilters);
        }
    }
    
    // Pagination
    const paginationEl = document.getElementById('pagination');
    if (paginationEl) {
        paginationEl.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (page && page !== currentPage) {
                currentPage = page;
                loadMaterials(currentPage, currentFilters);
            }
        });
    }
    
    // Export button
    if (exportBtn) {
        exportBtn.addEventListener('click', exportMaterials);
    }
    
    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadMaterials(currentPage, currentFilters);
        });
    }
});

// Initialize the application
const initializeInventory = async () => {
    try {
        showLoading(true);
        await Promise.all([
            loadCategories(),
            loadUnits(),
        ]);
        await loadMaterials();
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Failed to initialize inventory module', 'danger');
    } finally {
        showLoading(false);
    }
};

// Start the application
initializeInventory();