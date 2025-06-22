/**
 * Shared Pagination Utility
 * Provides consistent pagination functionality across all modules
 */

export class PaginationManager {
    constructor(options = {}) {
        this.currentPage = options.currentPage || 1;
        this.itemsPerPage = options.itemsPerPage || 6; // Default to 6 items per page
        this.totalPages = options.totalPages || 1;
        this.totalItems = options.totalItems || 0;
        this.filteredItems = options.filteredItems || [];
        this.allItems = options.allItems || [];
        
        // Callback functions
        this.onPageChange = options.onPageChange || (() => {});
        this.onRender = options.onRender || (() => {});
    }

    /**
     * Update pagination data
     */
    updateData(filteredItems, allItems = null) {
        this.filteredItems = filteredItems;
        if (allItems) this.allItems = allItems;
        this.totalItems = filteredItems.length;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        
        // Ensure current page is valid
        if (this.currentPage > this.totalPages && this.totalPages > 0) {
            this.currentPage = this.totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }
    }

    /**
     * Get items for current page
     */
    getCurrentPageItems() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return this.filteredItems.slice(startIndex, endIndex);
    }

    /**
     * Change to a specific page
     */
    changePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.onPageChange(this.currentPage);
            return true;
        }
        return false;
    }

    /**
     * Go to specific page number
     */
    goToPage(pageNumber) {
        if (pageNumber >= 1 && pageNumber <= this.totalPages) {
            this.currentPage = pageNumber;
            this.onPageChange(this.currentPage);
            return true;
        }
        return false;
    }

    /**
     * Get pagination info
     */
    getPaginationInfo() {
        const startItem = this.totalItems > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
        
        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalItems: this.totalItems,
            itemsPerPage: this.itemsPerPage,
            startItem,
            endItem,
            hasNext: this.currentPage < this.totalPages,
            hasPrev: this.currentPage > 1
        };
    }

    /**
     * Generate pagination HTML (following debts module design)
     */
    generatePaginationHTML(prevBtnId = 'prevBtn', nextBtnId = 'nextBtn', pageInfoId = 'pageInfo') {
        const info = this.getPaginationInfo();
        
        return `
            <div class="pagination" id="pagination">
                <button class="pagination-btn" id="${prevBtnId}" ${!info.hasPrev ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span id="${pageInfoId}">Page ${info.currentPage} of ${info.totalPages}</span>
                <button class="pagination-btn" id="${nextBtnId}" ${!info.hasNext ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    /**
     * Update pagination controls in DOM
     */
    updatePaginationControls(prevBtnId = 'prevBtn', nextBtnId = 'nextBtn', pageInfoId = 'pageInfo') {
        const info = this.getPaginationInfo();
        
        const prevBtn = document.getElementById(prevBtnId);
        const nextBtn = document.getElementById(nextBtnId);
        const pageInfo = document.getElementById(pageInfoId);
        
        if (prevBtn) {
            prevBtn.disabled = !info.hasPrev;
        }
        if (nextBtn) {
            nextBtn.disabled = !info.hasNext;
        }
        if (pageInfo) {
            pageInfo.textContent = `Page ${info.currentPage} of ${info.totalPages}`;
        }
    }

    /**
     * Attach event listeners to pagination controls
     */
    attachEventListeners(prevBtnId = 'prevBtn', nextBtnId = 'nextBtn') {
        const prevBtn = document.getElementById(prevBtnId);
        const nextBtn = document.getElementById(nextBtnId);
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.changePage(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.changePage(1));
        }
    }

    /**
     * Reset to first page
     */
    resetToFirstPage() {
        this.currentPage = 1;
    }

    /**
     * Static method to create pagination manager with consistent defaults
     */
    static create(options = {}) {
        return new PaginationManager({
            itemsPerPage: 6, // Consistent 6 items per page
            ...options
        });
    }
}

/**
 * Pagination CSS utilities
 */
export const PaginationCSS = {
    /**
     * Inject pagination CSS if not already present
     */
    injectCSS() {
        if (document.getElementById('pagination-utils-css')) return;
        
        const style = document.createElement('style');
        style.id = 'pagination-utils-css';
        style.textContent = `
            /* Pagination Styles - Consistent with debts.css */
            .pagination {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-top: 30px;
                gap: 10px;
            }

            .pagination-btn {
                padding: 10px 15px;
                border: 2px solid #e1e8ed;
                background: white;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.9rem;
            }

            .pagination-btn:hover:not(:disabled) {
                background: #3498db;
                color: white;
                border-color: #3498db;
            }

            .pagination-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            #pageInfo {
                font-weight: 500;
                color: #2c3e50;
                padding: 0 15px;
            }

            /* Show/hide pagination based on content */
            .pagination[style*="display: none"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
};

export default PaginationManager;