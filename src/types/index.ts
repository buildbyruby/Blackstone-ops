export type OrderStatus = 'new'|'confirmed'|'processing'|'out-for-delivery'|'delivered'|'cancelled'
export type CustomerStatus = 'pending'|'approved'|'rejected'
export type NotifType = 'order'|'access'|'message'|'stock'
export interface Product { id:string; name:string; description:string|null; price:number; stock:number; emoji:string; image_url:string|null; category_id:string|null; is_active:boolean; created_at:string; updated_at:string }
export interface Customer { id:string; name:string; phone:string; status:CustomerStatus; scanned_at:string; approved_at:string|null; created_at:string }
export interface Order { id:string; order_ref:string; customer_id:string|null; location:string; notes:string|null; total:number; status:OrderStatus; created_at:string; updated_at:string }
export interface OrderItem { id:string; order_id:string; product_id:string|null; name:string; price:number; quantity:number }
export interface Message { id:string; customer_id:string; from_admin:boolean; body:string; order_id:string|null; read:boolean; created_at:string }
export interface Notification { id:string; type:NotifType; title:string; body:string|null; read:boolean; link:string|null; created_at:string }
export interface CartItem { product_id:string; name:string; emoji:string; price:number; quantity:number }
export interface OrderSummary { id:string; order_ref:string; status:OrderStatus; total:number; location:string; notes:string|null; created_at:string; customer_name:string; customer_phone:string; items:{name:string;quantity:number;price:number}[] }
export const ORDER_STATUSES = ['new','confirmed','processing','out-for-delivery','delivered','cancelled'] as const
