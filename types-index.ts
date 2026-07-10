// src/types/index.ts

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'processing'
  | 'out-for-delivery'
  | 'delivered'
  | 'cancelled'

export type CustomerStatus = 'pending' | 'approved' | 'rejected'

export type NotifType = 'order' | 'access' | 'message' | 'stock'

export type MessageSender = 'admin' | 'customer'

// ── DATABASE ROW TYPES ────────────────────────────────────────

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  emoji: string
  image_url: string | null
  category_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  category?: Category
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface Customer {
  id: string
  name: string
  phone: string
  status: CustomerStatus
  scanned_at: string
  approved_at: string | null
  created_at: string
}

export interface Order {
  id: string
  order_ref: string
  customer_id: string | null
  location: string
  notes: string | null
  total: number
  status: OrderStatus
  created_at: string
  updated_at: string
  customer?: Customer
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  name: string
  price: number
  quantity: number
}

export interface Message {
  id: string
  customer_id: string
  from_admin: boolean
  body: string
  order_id: string | null
  read: boolean
  created_at: string
  customer?: Customer
}

export interface Notification {
  id: string
  type: NotifType
  title: string
  body: string | null
  read: boolean
  link: string | null
  created_at: string
}

export interface Setting {
  id: string
  key: string
  value: string | null
}

// ── API REQUEST / RESPONSE TYPES ──────────────────────────────

export interface PlaceOrderRequest {
  customer_id: string
  location: string
  notes?: string
  items: {
    product_id: string
    name: string
    price: number
    quantity: number
  }[]
}

export interface SendMessageRequest {
  customer_id: string
  body: string
  from_admin: boolean
  order_id?: string
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus
}

export interface RegisterCustomerRequest {
  name: string
  phone: string
}

export interface ApproveCustomerRequest {
  action: 'approve' | 'reject'
}

// ── UI / STORE TYPES ──────────────────────────────────────────

export interface CartItem {
  product_id: string
  name: string
  emoji: string
  price: number
  quantity: number
}

export interface OrderSummary {
  id: string
  order_ref: string
  status: OrderStatus
  total: number
  location: string
  notes: string | null
  created_at: string
  customer_name: string
  customer_phone: string
  items: {
    name: string
    quantity: number
    price: number
  }[]
}

export interface DashboardStats {
  total_revenue: number
  active_orders: number
  total_customers: number
  pending_approvals: number
  out_for_delivery: number
  delivered_today: number
}

export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'new',              label: 'New',              color: 'blue'   },
  { value: 'confirmed',        label: 'Confirmed',        color: 'gold'   },
  { value: 'processing',       label: 'Processing',       color: 'purple' },
  { value: 'out-for-delivery', label: 'Out for Delivery', color: 'orange' },
  { value: 'delivered',        label: 'Delivered',        color: 'green'  },
  { value: 'cancelled',        label: 'Cancelled',        color: 'red'    },
]
