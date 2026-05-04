export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'paid'
  | 'cancelled';

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
  tax_rate: number;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  number: number;
  capacity: number;
  qr_token: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  is_chef_pick: boolean;
  is_available: boolean;
  allergens: string[] | null;
  sort_order: number;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  table_number: number | null;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  price: number;
  qty: number;
  notes: string | null;
}

export interface CartLine {
  item: MenuItem;
  qty: number;
  notes?: string;
}
