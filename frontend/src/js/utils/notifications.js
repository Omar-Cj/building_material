// notifications.js - Shared notification utility for consistent UI design
// Based on the customers/debts implementation pattern

class NotificationManager {
    constructor() {
        this.initializeStyles();
    }

    initializeStyles() {
        // Only add styles once to prevent duplicates
        if (document.querySelector('#notification-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                animation: slideIn 0.3s ease;
                transition: opacity 0.3s ease;
                min-width: 300px;
                max-width: 500px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                backdrop-filter: blur(10px);
            }
            
            .notification.success {
                background: linear-gradient(135deg, #27ae60, #229954);
            }
            
            .notification.error {
                background: linear-gradient(135deg, #e74c3c, #c0392b);
            }
            
            .notification.warning {
                background: linear-gradient(135deg, #f39c12, #e67e22);
            }
            
            .notification.info {
                background: linear-gradient(135deg, #3498db, #2980b9);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .notification-content i {
                font-size: 18px;
                flex-shrink: 0;
            }
            
            .notification-message {
                flex: 1;
                line-height: 1.4;
            }
            
            @keyframes slideIn {
                from { 
                    transform: translateX(100%); 
                    opacity: 0; 
                }
                to { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
            }
            
            @keyframes slideOut {
                from { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
                to { 
                    transform: translateX(100%); 
                    opacity: 0; 
                }
            }
            
            .notification.slide-out {
                animation: slideOut 0.3s ease;
            }
            
            /* Handle multiple notifications */
            .notification:not(:first-child) {
                margin-top: 10px;
            }
        `;
        document.head.appendChild(style);
    }

    showNotification(message, type = 'info', duration = 4000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Get appropriate icon for the type
        const iconClass = this.getIconClass(type);
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${iconClass}"></i>
                <div class="notification-message">${this.escapeHtml(message)}</div>
            </div>
        `;
        
        // Handle positioning for multiple notifications
        this.adjustExistingNotifications();
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after specified duration
        setTimeout(() => {
            this.removeNotification(notification);
        }, duration);
        
        return notification;
    }

    showSuccess(message, duration = 4000) {
        return this.showNotification(message, 'success', duration);
    }

    showError(message, duration = 5000) {
        return this.showNotification(message, 'error', duration);
    }

    showWarning(message, duration = 4000) {
        return this.showNotification(message, 'warning', duration);
    }

    showInfo(message, duration = 4000) {
        return this.showNotification(message, 'info', duration);
    }

    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.classList.add('slide-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                    this.repositionNotifications();
                }
            }, 300);
        }
    }

    adjustExistingNotifications() {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach((notification, index) => {
            notification.style.top = `${20 + (index * 80)}px`;
        });
    }

    repositionNotifications() {
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach((notification, index) => {
            notification.style.top = `${20 + (index * 80)}px`;
        });
    }

    getIconClass(type) {
        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return iconMap[type] || 'fa-info-circle';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Clear all notifications
    clearAll() {
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => {
            this.removeNotification(notification);
        });
    }
}

// Create global instance
const notificationManager = new NotificationManager();

// Export for ES6 modules
export default notificationManager;

// Also make available globally for modules that don't use ES6 imports
window.notificationManager = notificationManager;

// Convenient global functions
window.showSuccess = (message, duration) => notificationManager.showSuccess(message, duration);
window.showError = (message, duration) => notificationManager.showError(message, duration);
window.showWarning = (message, duration) => notificationManager.showWarning(message, duration);
window.showInfo = (message, duration) => notificationManager.showInfo(message, duration);