# Building Material Management System

A comprehensive web-based building material management system built with Django REST Framework backend and Vite-powered frontend.

## Overview

This system manages building materials inventory, sales, purchases, customers, suppliers, debts, expenses, and provides comprehensive reporting capabilities. It's designed for building material businesses to streamline their operations and maintain accurate inventory tracking with advanced credit management.

## Architecture

- **Backend**: Django 5.2.1 with Django REST Framework
- **Frontend**: Vanilla JavaScript with Vite build tool
- **Database**: MySQL
- **Authentication**: JWT-based authentication using Simple JWT
- **UI Framework**: Bootstrap 5.3.6
- **Charts**: Chart.js 4.4.9

## Key Features

### 1. Inventory Management
- **Material Catalog**: Complete material information with SKU, descriptions, categories
- **Stock Tracking**: Real-time inventory levels with automatic low-stock alerts
- **Categories & Units**: Hierarchical categorization and flexible unit of measure support
- **Stock Adjustments**: Comprehensive tracking of inventory changes with audit trail
- **Supplier Integration**: Link materials to main and alternative suppliers
- **Location Tracking**: Warehouse, zone, rack, shelf, and bin location management
- **Reorder Management**: Automatic reorder level monitoring and notifications

### 2. Sales Management
- **Customer Sales**: Complete sales transaction management
- **Multiple Payment Methods**: Support for Cash, Zaad, Edahab, and Credit payment systems
- **Credit Sales**: Enable customers to purchase materials on credit with due date tracking
- **Payment Status Tracking**: Monitor payment status (paid, pending, partial) for credit sales
- **Tax & Discount Handling**: Flexible tax and discount application
- **Sale Items**: Detailed line item tracking with pricing history
- **Stock Deduction**: Automatic inventory reduction on sales completion

### 3. Purchase Management
- **Supplier Orders**: Purchase order creation and management
- **Stock Receiving**: Incoming inventory tracking and stock level updates
- **Cost Tracking**: Purchase cost recording for accurate cost analysis
- **Supplier Relations**: Comprehensive supplier information management

### 4. Customer Management
- **Customer Database**: Complete customer information storage
- **Credit Management**: Credit limit setting and outstanding balance tracking
- **Sales History**: Track all customer transactions and relationships
- **Contact Management**: Phone, email, and address information
- **Payment Terms**: Flexible payment terms and conditions management

### 5. Supplier Management
- **Supplier Database**: Comprehensive supplier information
- **Material Relationships**: Track which suppliers provide which materials
- **Contact Information**: Complete supplier contact details

### 6. Debt Management (NEW)
- **Customer Credit Sales**: Enable customers to take materials on credit
- **Debt Tracking**: Comprehensive debt lifecycle management with status tracking
- **Payment Recording**: Record partial and full payments against outstanding debts
- **Interest Calculation**: Automatic interest calculation for overdue debts
- **Payment Reminders**: Automated reminder system for due payments
- **Credit Limit Enforcement**: Automatic validation against customer credit limits
- **Overdue Management**: Track and manage overdue debts with priority levels
- **Payment History**: Complete audit trail of all debt-related transactions
- **Collection Analytics**: Collection rate tracking and performance metrics

### 7. Expense Management
- **Expense Categories**: Categorized expense tracking
- **Cost Center Management**: Track expenses across different business areas
- **Date-based Reporting**: Time-based expense analysis

### 8. Dashboard & Analytics
- **Real-time Metrics**: Key performance indicators and business metrics
- **Visual Charts**: Interactive charts using Chart.js
- **Inventory Value**: Current stock value calculations
- **Top Selling Materials**: Performance analytics
- **Recent Activities**: Activity feed and transaction history
- **Monthly Summaries**: Period-based business performance

### 9. Reports
- **Inventory Reports**: Stock levels, valuations, and movement reports
- **Sales Reports**: Sales performance and customer analysis
- **Purchase Reports**: Procurement analytics and supplier performance
- **Debt Reports**: Outstanding debts, collection rates, and customer credit analysis
- **Financial Reports**: Revenue, costs, and profitability analysis
- **PDF Export**: Report generation using ReportLab for all report types

### 10. User Management & Security
- **Custom User Model**: Extended user authentication system
- **Role-based Permissions**: Granular access control
- **JWT Authentication**: Secure token-based authentication
- **CORS Configuration**: Secure cross-origin resource sharing
- **Audit Trail**: User action tracking for all major operations

## Technical Specifications

### Backend Dependencies
- **Django**: 5.2.1 - Web framework
- **Django REST Framework**: API development
- **Django CORS Headers**: Cross-origin resource sharing
- **Djoser**: Authentication endpoints
- **Simple JWT**: JWT token authentication
- **MySQL Client**: Database connectivity
- **Pandas**: Data processing for reports
- **ReportLab**: PDF report generation
- **Django Filter**: API filtering capabilities
- **Django Debug Toolbar**: Development debugging

### Frontend Dependencies
- **Vite**: 6.3.5 - Build tool and development server
- **Bootstrap**: 5.3.6 - UI framework
- **Chart.js**: 4.4.9 - Data visualization
- **Sass**: SCSS preprocessing support

### Database Schema
- **MySQL Database**: `building_material`
- **Models**: Material, Category, UnitOfMeasure, Sale, Purchase, Customer, Supplier, Debt, DebtPayment, DebtReminder, Expense, User
- **Relationships**: Comprehensive foreign key relationships with data integrity
- **Migrations**: Full Django migration system for schema management

## Development Setup

### Backend Setup
```bash
cd backend
pipenv install
pipenv shell
python manage.py migrate
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## API Structure

### Authentication Endpoints
- JWT token management
- User registration and login
- Token refresh capabilities

### Core API Endpoints
- `/api/inventory/` - Material and inventory management
- `/api/sales/` - Sales transaction handling
- `/api/purchases/` - Purchase order management
- `/api/customers/` - Customer information
- `/api/suppliers/` - Supplier management
- `/api/debts/` - Debt and credit management
- `/api/expenses/` - Expense tracking
- `/api/reports/` - Report generation
- `/api/dashboard/` - Dashboard data

## Security Features

- JWT-based authentication with 4-hour access token lifetime
- CORS protection with specific origin allowlisting
- CSRF protection for form submissions
- SQL injection prevention through Django ORM
- Input validation and sanitization
- Role-based access control

## Performance Optimizations

- Database query optimization with select_related and prefetch_related
- Frontend asset bundling with Vite
- Lazy loading for large datasets
- Efficient API pagination
- Chart data caching and optimization

---

## Change Review Log

### Recent Updates (Last 10 Commits)

#### 2024 - Latest Updates

**[Current Update]** - Implement comprehensive Debts Management System
- **Type**: Major New Feature
- **Scope**: Complete Credit Management System
- **Impact**: Critical business functionality addition
- **Details**: 
  - **Backend**: Complete Django app with Debt, DebtPayment, and DebtReminder models
  - **API**: RESTful endpoints for debt management, payment recording, and reporting
  - **Frontend**: Full debt management interface with real-time tracking
  - **Features**: Customer credit sales, payment recording, overdue tracking, PDF reporting
  - **Integration**: Enhanced Sales model with credit payment support
  - **UI/UX**: Seamless integration with existing design system and navigation

**052c525** - Fix tiny issues on frontend UI
- **Type**: Bug Fix
- **Scope**: Frontend UI
- **Impact**: Minor UI improvements and fixes
- **Details**: Resolved small visual inconsistencies across the application

**46af0d5** - Update minor UI issues purchases module on frontend
- **Type**: Enhancement
- **Scope**: Purchases Module UI
- **Impact**: Improved user experience in purchases interface
- **Details**: Fixed layout issues and improved form validation feedback

**27850af** - Update logo name on frontend
- **Type**: Update
- **Scope**: Branding
- **Impact**: Visual branding update
- **Details**: Updated application logo and branding elements

**bd22e26** - Redefine the dashboard UI on the frontend
- **Type**: Major Enhancement
- **Scope**: Dashboard Interface
- **Impact**: Significant UI/UX improvement
- **Details**: Complete dashboard redesign with improved layout, better data visualization, and enhanced user experience

**577fc0f** - Refactor inventory module on the frontend
- **Type**: Refactoring
- **Scope**: Inventory Module
- **Impact**: Code quality and maintainability improvement
- **Details**: Restructured inventory module code for better performance and maintainability

**a6eea9e** - Implement Report functionality in the frontend
- **Type**: New Feature
- **Scope**: Reports Module
- **Impact**: Major feature addition
- **Details**: Added comprehensive reporting capabilities with data visualization and export options

**f566a19** - Implement Expenses module on the frontend
- **Type**: New Feature
- **Scope**: Expenses Management
- **Impact**: Major feature addition
- **Details**: Complete expenses tracking and management system implementation

**7d93dce** - Implement Sales module in frontend
- **Type**: New Feature
- **Scope**: Sales Management
- **Impact**: Major feature addition
- **Details**: Full sales transaction management with customer integration and payment processing

**0181563** - Implement Purchases module on the frontend
- **Type**: New Feature
- **Scope**: Purchases Management
- **Impact**: Major feature addition
- **Details**: Purchase order management with supplier integration and inventory updates

**02180c7** - Redesign the suppliers module UI
- **Type**: Enhancement
- **Scope**: Suppliers Module UI
- **Impact**: Improved user experience
- **Details**: Enhanced supplier management interface with better data presentation and form handling

### Summary of Recent Development Phase

The recent development demonstrates a comprehensive system enhancement focusing on:

1. **Major Feature Addition**: Complete Debts Management System implementation with full-stack integration
2. **Module Implementation**: Complete implementation of core business modules (Sales, Purchases, Expenses, Reports, Debts)
3. **Credit Management**: Advanced customer credit and debt tracking capabilities
4. **UI/UX Improvements**: Significant focus on user interface enhancements and user experience optimization
5. **Dashboard Enhancement**: Major dashboard redesign for better data visualization and usability
6. **Code Quality**: Refactoring efforts to improve maintainability and performance
7. **Bug Fixes**: Continuous improvement with small bug fixes and UI refinements

### Change Impact Assessment

- **Critical Impact Changes**: Complete Debts Management System implementation
- **High Impact Changes**: Dashboard redesign, new module implementations, credit management integration
- **Medium Impact Changes**: UI redesigns, refactoring efforts, enhanced sales functionality
- **Low Impact Changes**: Bug fixes, minor UI improvements, branding updates

---

## Future Enhancement Opportunities

- **Debt Management Enhancements**:
  - Automated payment reminder notifications via SMS/Email
  - Integration with payment gateways for online debt payments
  - Advanced debt analytics and collection forecasting
  - Customer credit scoring system
- **General System Improvements**:
  - Mobile responsiveness improvements
  - Advanced reporting with more chart types
  - Integration with external accounting systems
  - Barcode scanning for inventory management
  - Advanced inventory forecasting
  - Multi-location inventory management
  - Customer portal for order tracking and debt payments
  - Supplier portal integration
  - Advanced user roles and permissions
  - Real-time notifications system

---

## Maintenance Notes

- **Database Management**:
  - Regular database backups recommended
  - Monitor debt payment data integrity
  - Regular cleanup of old debt reminder records
- **Security & Performance**:
  - Monitor JWT token expiration and refresh cycles
  - Keep dependencies updated for security
  - Regular performance monitoring of database queries
  - Monitor debt calculation performance for large datasets
- **Deployment & Infrastructure**:
  - Frontend asset optimization for production deployment
  - SSL certificate management for production
  - Environment-specific configuration management
- **Debt System Specific**:
  - Regular audit of debt calculations and interest computations
  - Monitor credit limit validations and enforcement
  - Review debt reporting accuracy and performance

---

*Last Updated: June 2024*
*Version: 1.1 - Debts Management System Added*
*Maintainer: Development Team*