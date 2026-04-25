# React Frontend Architecture Design
## JSPCS POS - Browser-Based UI System

---

## 1. Folder Structure

### 1.1 Complete Directory Structure

```
jspcs-pos-frontend/
│
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── assets/
│       ├── images/
│       └── fonts/
│
├── src/
│   ├── index.jsx
│   ├── App.jsx
│   ├── main.css
│   │
│   ├── api/                          # API client layer
│   │   ├── axios.js                  # Axios instance
│   │   ├── auth.js                   # Auth API endpoints
│   │   ├── products.js               # Product API endpoints
│   │   ├── inventory.js              # Inventory API endpoints
│   │   ├── sales.js                  # Sales/Invoice API endpoints
│   │   ├── payments.js               # Payment API endpoints
│   │   ├── users.js                  # User API endpoints
│   │   ├── reports.js                # Report API endpoints
│   │   └── admin.js                  # Admin API endpoints
│   │
│   ├── websocket/                    # WebSocket client
│   │   ├── WebSocketService.js       # WebSocket service
│   │   ├── useWebSocket.js           # WebSocket hook
│   │   ├── events/                   # Event handlers
│   │   │   ├── stockEvents.js
│   │   │   ├── priceEvents.js
│   │   │   ├── saleEvents.js
│   │   │   └── configEvents.js
│   │   └── hooks/
│   │       ├── useStockUpdates.js
│   │       ├── usePriceUpdates.js
│   │       └── useSaleUpdates.js
│   │
│   ├── store/                        # State management (Zustand/Redux)
│   │   ├── index.js
│   │   ├── slices/
│   │   │   ├── authSlice.js          # Authentication state
│   │   │   ├── cartSlice.js          # Shopping cart state
│   │   │   ├── productsSlice.js      # Products state
│   │   │   ├── inventorySlice.js     # Inventory state
│   │   │   ├── invoicesSlice.js      # Invoices state
│   │   │   ├── uiSlice.js            # UI state (modals, notifications)
│   │   │   └── connectionSlice.js    # WebSocket connection state
│   │   └── selectors/
│   │       ├── authSelectors.js
│   │       ├── cartSelectors.js
│   │       └── productSelectors.js
│   │
│   ├── router/                       # Routing configuration
│   │   ├── index.jsx                 # Router setup
│   │   ├── routes.js                 # Route definitions
│   │   ├── PrivateRoute.jsx          # Protected route wrapper
│   │   └── PublicRoute.jsx           # Public route wrapper
│   │
│   ├── layouts/                      # Layout components
│   │   ├── AdminLayout.jsx           # Admin panel layout
│   │   ├── CashierLayout.jsx         # Cashier panel layout
│   │   ├── AuthLayout.jsx            # Login layout
│   │   └── components/
│   │       ├── Sidebar.jsx
│   │       ├── Header.jsx
│   │       ├── Navbar.jsx
│   │       └── Footer.jsx
│   │
│   ├── features/                     # Feature-based modules
│   │   │
│   │   ├── auth/                     # Authentication feature
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   └── LogoutButton.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.js
│   │   │   │   └── useLogin.js
│   │   │   └── pages/
│   │   │       └── LoginPage.jsx
│   │   │
│   │   ├── admin/                    # Admin panel feature
│   │   │   ├── components/
│   │   │   │   ├── Dashboard/
│   │   │   │   │   ├── DashboardStats.jsx
│   │   │   │   │   ├── SalesChart.jsx
│   │   │   │   │   └── RecentSales.jsx
│   │   │   │   ├── Products/
│   │   │   │   │   ├── ProductList.jsx
│   │   │   │   │   ├── ProductForm.jsx
│   │   │   │   │   ├── ProductCard.jsx
│   │   │   │   │   └── ProductSearch.jsx
│   │   │   │   ├── Inventory/
│   │   │   │   │   ├── InventoryList.jsx
│   │   │   │   │   ├── StockAdjustmentForm.jsx
│   │   │   │   │   └── LowStockAlerts.jsx
│   │   │   │   ├── Users/
│   │   │   │   │   ├── UserList.jsx
│   │   │   │   │   ├── UserForm.jsx
│   │   │   │   │   └── UserCard.jsx
│   │   │   │   ├── Reports/
│   │   │   │   │   ├── SalesReport.jsx
│   │   │   │   │   ├── InventoryReport.jsx
│   │   │   │   │   └── ReportFilters.jsx
│   │   │   │   └── Settings/
│   │   │   │       ├── SystemSettings.jsx
│   │   │   │       └── CounterSettings.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useProducts.js
│   │   │   │   ├── useInventory.js
│   │   │   │   ├── useUsers.js
│   │   │   │   └── useReports.js
│   │   │   └── pages/
│   │   │       ├── AdminDashboardPage.jsx
│   │   │       ├── ProductsPage.jsx
│   │   │       ├── InventoryPage.jsx
│   │   │       ├── UsersPage.jsx
│   │   │       ├── ReportsPage.jsx
│   │   │       └── SettingsPage.jsx
│   │   │
│   │   ├── cashier/                  # Cashier panel feature
│   │   │   ├── components/
│   │   │   │   ├── Billing/
│   │   │   │   │   ├── BillingPanel.jsx
│   │   │   │   │   ├── ProductSearchBar.jsx
│   │   │   │   │   ├── Cart.jsx
│   │   │   │   │   ├── CartItem.jsx
│   │   │   │   │   ├── CartTotal.jsx
│   │   │   │   │   ├── DiscountPanel.jsx
│   │   │   │   │   └── PaymentPanel.jsx
│   │   │   │   ├── ProductGrid/
│   │   │   │   │   ├── ProductGrid.jsx
│   │   │   │   │   ├── ProductCard.jsx
│   │   │   │   │   └── ProductQuickAdd.jsx
│   │   │   │   ├── Invoice/
│   │   │   │   │   ├── InvoiceView.jsx
│   │   │   │   │   ├── InvoicePrint.jsx
│   │   │   │   │   └── InvoiceHistory.jsx
│   │   │   │   └── Hold/
│   │   │   │       ├── HoldCartModal.jsx
│   │   │   │       └── ResumeCartModal.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useCart.js
│   │   │   │   ├── useBilling.js
│   │   │   │   ├── useBarcodeScanner.js
│   │   │   │   └── useKeyboardShortcuts.js
│   │   │   └── pages/
│   │   │       ├── CashierDashboardPage.jsx
│   │   │       ├── BillingPage.jsx
│   │   │       └── InvoiceHistoryPage.jsx
│   │   │
│   │   └── shared/                   # Shared components
│   │       ├── components/
│   │       │   ├── Button.jsx
│   │       │   ├── Input.jsx
│   │       │   ├── Select.jsx
│   │       │   ├── Modal.jsx
│   │       │   ├── Table.jsx
│   │       │   ├── Card.jsx
│   │       │   ├── Badge.jsx
│   │       │   ├── LoadingSpinner.jsx
│   │       │   ├── ErrorBoundary.jsx
│   │       │   ├── ConnectionStatus.jsx
│   │       │   └── OfflineIndicator.jsx
│   │       ├── hooks/
│   │       │   ├── useApi.js
│   │       │   ├── useDebounce.js
│   │       │   ├── useLocalStorage.js
│   │       │   └── useOnlineStatus.js
│   │       ├── utils/
│   │       │   ├── format.js         # Number/date formatting
│   │       │   ├── validation.js     # Form validation
│   │       │   ├── constants.js      # Constants
│   │       │   └── helpers.js        # Helper functions
│   │       └── styles/
│   │           ├── tailwind.config.js
│   │           └── components.css
│   │
│   ├── context/                      # React Context (if needed)
│   │   ├── AuthContext.jsx
│   │   └── WebSocketContext.jsx
│   │
│   └── utils/                        # Global utilities
│       ├── constants.js
│       ├── helpers.js
│       └── errors.js
│
├── package.json
├── vite.config.js (or webpack.config.js)
├── tailwind.config.js
├── postcss.config.js
├── .env
├── .env.local
└── README.md
```

---

## 2. Component Hierarchy

### 2.1 Application Structure

```
App.jsx
├── Router
│   ├── PublicRoute (Login)
│   │   └── AuthLayout
│   │       └── LoginPage
│   │
│   └── PrivateRoute (Authenticated)
│       ├── AdminRoute
│       │   └── AdminLayout
│       │       ├── Header
│       │       ├── Sidebar
│       │       └── Outlet (Admin Pages)
│       │           ├── AdminDashboardPage
│       │           ├── ProductsPage
│       │           ├── InventoryPage
│       │           ├── UsersPage
│       │           ├── ReportsPage
│       │           └── SettingsPage
│       │
│       └── CashierRoute
│           └── CashierLayout
│               ├── Header
│               ├── ConnectionStatus
│               └── Outlet (Cashier Pages)
│                   ├── CashierDashboardPage
│                   ├── BillingPage
│                   │   ├── BillingPanel
│                   │   │   ├── ProductSearchBar
│                   │   │   ├── Cart
│                   │   │   │   ├── CartItem (multiple)
│   │   │   │   └── CartTotal
│                   │   │   ├── DiscountPanel
│                   │   │   └── PaymentPanel
│                   │   └── ProductGrid (optional)
│                   │       └── ProductCard (multiple)
│                   └── InvoiceHistoryPage
│                       └── InvoiceList
```

### 2.2 Admin Layout Hierarchy

```
AdminLayout
├── Header
│   ├── Logo
│   ├── UserMenu
│   │   ├── UserInfo
│   │   └── LogoutButton
│   └── ConnectionStatus
│
├── Sidebar
│   ├── NavItem (Dashboard)
│   ├── NavItem (Products)
│   ├── NavItem (Inventory)
│   ├── NavItem (Sales)
│   ├── NavItem (Users)
│   ├── NavItem (Reports)
│   └── NavItem (Settings)
│
└── Main Content Area
    └── Outlet (Route Pages)
        ├── AdminDashboardPage
        │   ├── DashboardStats
        │   ├── SalesChart
        │   └── RecentSales
        │
        ├── ProductsPage
        │   ├── ProductSearch
        │   ├── ProductList
        │   │   └── ProductCard (multiple)
        │   └── ProductForm (Modal)
        │
        ├── InventoryPage
        │   ├── InventoryList
        │   ├── LowStockAlerts
        │   └── StockAdjustmentForm (Modal)
        │
        └── ... (other pages)
```

### 2.3 Cashier Layout Hierarchy

```
CashierLayout
├── Header
│   ├── CounterInfo
│   ├── UserInfo
│   ├── ConnectionStatus
│   └── LogoutButton
│
└── Main Content Area
    └── Outlet (Route Pages)
        └── BillingPage
            ├── BillingPanel
            │   ├── ProductSearchBar
            │   │   ├── BarcodeInput (focus-first)
            │   │   └── ManualSearchInput
            │   │
            │   ├── Cart
            │   │   ├── CartItem (multiple)
            │   │   │   ├── ProductInfo
            │   │   │   ├── QuantityControls
            │   │   │   ├── PriceInfo
            │   │   │   └── RemoveButton
            │   │   │
            │   │   └── CartTotal
            │   │       ├── Subtotal
            │   │       ├── Discount
            │   │       ├── Tax
            │   │       └── GrandTotal
            │   │
            │   ├── DiscountPanel
            │   │   ├── ItemDiscountButton
            │   │   └── InvoiceDiscountInput
            │   │
            │   └── PaymentPanel
            │       ├── PaymentModeButtons
            │       ├── AmountInput
            │       └── ProcessPaymentButton
            │
            └── ProductGrid (optional)
                └── ProductCard (multiple)
                    └── QuickAddButton
```

---

## 3. Routing Strategy

### 3.1 Route Configuration

**Location**: `src/router/routes.js`

```javascript
// Route definitions
export const routes = {
  // Public routes
  LOGIN: '/login',
  
  // Admin routes
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_INVENTORY: '/admin/inventory',
  ADMIN_USERS: '/admin/users',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_SETTINGS: '/admin/settings',
  
  // Cashier routes
  CASHIER_DASHBOARD: '/cashier/dashboard',
  CASHIER_BILLING: '/cashier/billing',
  CASHIER_INVOICES: '/cashier/invoices',
};
```

### 3.2 Router Setup

**Location**: `src/router/index.jsx`

**Routing Strategy:**
- **Route-Based Code Splitting**: Lazy load route components
- **Role-Based Routing**: Admin routes vs Cashier routes
- **Protected Routes**: Authentication required
- **Redirect Strategy**: Default redirect based on role

**Route Structure:**
```
/ (root)
  └── /login (public)
  └── /admin/* (protected, ADMIN role)
      ├── /admin/dashboard
      ├── /admin/products
      ├── /admin/inventory
      ├── /admin/users
      ├── /admin/reports
      └── /admin/settings
  └── /cashier/* (protected, CASHIER or ADMIN role)
      ├── /cashier/dashboard
      ├── /cashier/billing
      └── /cashier/invoices
```

### 3.3 Route Protection

**PrivateRoute Component**:
- Checks authentication
- Redirects to `/login` if not authenticated
- Renders protected component if authenticated

**Role-Based Route Protection**:
- AdminRoute: Requires ADMIN role
- CashierRoute: Requires CASHIER or ADMIN role
- Redirects to appropriate dashboard if role mismatch

---

## 4. State Management Approach

### 4.1 State Management Strategy

**Technology**: Zustand (recommended) or Redux Toolkit

**Strategy**: Hybrid approach
- **Global State**: Authentication, Cart, WebSocket connection
- **Server State**: Products, Inventory, Invoices (React Query/TanStack Query)
- **Local State**: Form inputs, UI state (modals, dropdowns)

### 4.2 State Organization

#### Global State (Zustand/Redux)
```
store/
├── authSlice.js          # Authentication state
│   ├── user
│   ├── token
│   ├── role
│   └── isAuthenticated
│
├── cartSlice.js          # Shopping cart state
│   ├── items
│   ├── discount
│   ├── subtotal
│   ├── tax
│   └── grandTotal
│
├── productsSlice.js      # Products cache
│   ├── products (Map/Array)
│   ├── searchResults
│   └── selectedProduct
│
├── inventorySlice.js     # Inventory cache
│   ├── stockLevels (Map)
│   └── lowStockAlerts
│
├── invoicesSlice.js      # Recent invoices
│   ├── recentInvoices
│   └── selectedInvoice
│
├── uiSlice.js            # UI state
│   ├── modals
│   ├── notifications
│   ├── loading
│   └── errors
│
└── connectionSlice.js    # WebSocket connection
    ├── isConnected
    ├── isPolling
    └── connectionStatus
```

#### Server State (React Query/TanStack Query)
```
React Query Queries:
├── useProducts()         # Products list
├── useProduct(id)        # Single product
├── useInventory()        # Inventory levels
├── useStockLevel(productId)  # Single product stock
├── useInvoices()         # Invoice list
├── useInvoice(id)        # Single invoice
└── useReports()          # Reports
```

#### Local State (React useState)
```
Local State Examples:
├── Form inputs (controlled components)
├── Modal open/close state
├── Dropdown open/close state
├── Search input values
└── Component-specific UI state
```

### 4.3 State Ownership Strategy

**Global State (Store)**:
- **Ownership**: Application-level state
- **Examples**: Auth, Cart, WebSocket connection
- **Access**: Any component (via hooks/selectors)
- **Updates**: Actions/dispatchers

**Server State (React Query)**:
- **Ownership**: Server data (cached)
- **Examples**: Products, Inventory, Invoices
- **Access**: Components that need data (via hooks)
- **Updates**: Mutations, refetching

**Local State (useState)**:
- **Ownership**: Component-specific state
- **Examples**: Form inputs, UI state
- **Access**: Component and children (via props)
- **Updates**: setState

**Prop Drilling vs Context**:
- **Use Props**: For 1-2 levels deep
- **Use Context**: For deeply nested components
- **Use Store**: For widely shared state

---

## 5. WebSocket Integration

### 5.1 WebSocket Service Integration

**Location**: `src/websocket/WebSocketService.js`

**Integration Points:**
1. **App Level**: Initialize WebSocket connection on app start
2. **Store Level**: Update global state on WebSocket events
3. **Component Level**: Subscribe to specific events

### 5.2 WebSocket Hook

**Location**: `src/websocket/useWebSocket.js`

```javascript
// Custom hook for WebSocket integration
function useWebSocket(userRole, counterId) {
  // Connect on mount
  // Subscribe to topics based on role
  // Update store on events
  // Cleanup on unmount
}
```

### 5.3 Event Integration with State

**Stock Updates**:
- Update `inventorySlice` on stock events
- Update product stock levels in real-time
- Trigger UI updates (cart, product grid)

**Price Updates**:
- Update `productsSlice` on price events
- Update product prices in real-time
- Invalidate React Query cache if needed

**Sale Created**:
- Update `invoicesSlice` on sale events
- Add to recent invoices list
- Show notification

---

## 6. Keyboard-First Billing UX

### 6.1 Keyboard Navigation Strategy

**Focus Management:**
- Primary input: Barcode search bar (auto-focus)
- Tab order: Logical flow (left-to-right, top-to-bottom)
- Shortcut keys: Common operations (F-keys, Ctrl+key)

**Keyboard Shortcuts:**
```
Primary Actions:
├── Enter: Submit/Add item
├── Esc: Cancel/Close modal
├── Tab: Navigate to next field
├── Shift+Tab: Navigate to previous field
├── Ctrl+Enter: Process payment
├── Ctrl+H: Hold cart
└── F1: Focus barcode input

Cart Operations:
├── +: Increase quantity
├── -: Decrease quantity
├── Delete: Remove item
└── Enter: Edit quantity

Payment:
├── 1: Cash payment
├── 2: Card payment
├── 3: UPI payment
└── Enter: Process payment
```

### 6.2 Barcode Input Flow

```
1. Barcode input auto-focuses on page load
2. User scans barcode (or types)
3. On Enter/Scan:
   ├─> Search product by barcode
   ├─> If found: Add to cart (default quantity: 1)
   ├─> Clear input
   └─> Auto-focus input (ready for next scan)
4. If not found:
   ├─> Show product search modal
   └─> Focus search input in modal
```

### 6.3 Quick Actions

**Product Quick Add:**
- Barcode scan → Auto-add to cart
- Product grid click → Add to cart
- Manual search → Select → Add to cart

**Cart Quick Edit:**
- Focus on quantity → Edit → Enter
- Plus/Minus buttons → Increment/Decrement
- Delete button → Remove item

**Payment Quick Process:**
- Payment mode buttons → Select mode
- Amount input → Enter amount (default: grand total)
- Enter/Ctrl+Enter → Process payment

---

## 7. Offline-Safe UI Behavior

### 7.1 Offline Detection

**Location**: `src/shared/hooks/useOnlineStatus.js`

**Strategy:**
- Browser `navigator.onLine` API
- Network event listeners
- WebSocket connection status
- API request failures

### 7.2 Offline UI Behavior

**Visual Indicators:**
- **ConnectionStatus Component**: Show connection state
- **OfflineIndicator**: Banner/notification when offline
- **Disabled State**: Disable critical actions when offline

**UI States:**
```
Online:
├── All features enabled
├── Real-time updates via WebSocket
└── Green connection indicator

Offline (WebSocket disconnected):
├── Fallback to polling
├── Show "Polling" indicator (yellow)
├── Reduce update frequency
└── Queue failed operations

Offline (Network disconnected):
├── Show "Offline" indicator (red)
├── Disable critical operations (payment, invoice creation)
├── Allow local operations (cart, product search)
├── Queue operations for sync
└── Show pending operations count
```

### 7.3 Offline Operation Strategy

**Read Operations (Allowed):**
- View products (cached)
- View cart (local state)
- View recent invoices (cached)
- Search products (cached)

**Write Operations (Queued):**
- Add to cart (local state, sync on reconnect)
- Create invoice (disabled, show message)
- Process payment (disabled, show message)
- Stock adjustment (disabled, admin only)

**Sync Strategy:**
- **Queue Operations**: Store failed operations in localStorage
- **Retry on Reconnect**: Automatically retry queued operations
- **Conflict Resolution**: Handle conflicts on sync
- **User Notification**: Show sync status and results

### 7.4 Data Caching Strategy

**React Query Caching:**
- **Stale Time**: 5 minutes (products, inventory)
- **Cache Time**: 30 minutes
- **Refetch on Window Focus**: Enabled
- **Refetch on Reconnect**: Enabled

**LocalStorage Caching:**
- **Cart State**: Persist cart in localStorage
- **User Preferences**: Store user settings
- **Offline Queue**: Store failed operations

---

## 8. Component Design Principles

### 8.1 Component Organization

**Feature-Based Organization:**
- Group components by feature (admin, cashier, shared)
- Each feature has its own folder structure
- Shared components in `features/shared`

**Component Types:**
- **Pages**: Route components (top-level)
- **Components**: Reusable UI components
- **Hooks**: Custom React hooks
- **Utils**: Helper functions

### 8.2 Component Patterns

**Container/Presenter Pattern:**
- **Container**: Handles logic, state, API calls
- **Presenter**: Renders UI, receives props

**Compound Components:**
- Complex components with multiple sub-components
- Example: `Modal`, `Dropdown`, `Tabs`

**Render Props / Custom Hooks:**
- Reusable logic in hooks
- Components use hooks for functionality

---

## Summary

This React frontend architecture provides:

✅ **Complete Folder Structure**: Feature-based organization  
✅ **Component Hierarchy**: Clear component relationships  
✅ **Routing Strategy**: Role-based routing with protection  
✅ **State Management**: Hybrid approach (Store + React Query + Local)  
✅ **WebSocket Integration**: Real-time updates integrated with state  
✅ **Keyboard-First UX**: Full keyboard navigation and shortcuts  
✅ **Offline-Safe Behavior**: Graceful degradation and sync strategy  

**Status:** ✅ Frontend architecture design complete - Ready for implementation

