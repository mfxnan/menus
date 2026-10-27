export interface Category {
  id: string
  name: string
  description: string
  sort_order: number
  is_active: boolean
  archived_at: string | null
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  category_id: string
  image_path: string | null
  image_url?: string | null
  is_available: boolean
  is_published: boolean
  sort_order: number
  archived_at: string | null
}

export interface StoreSettings {
  id: number
  store_name: string
  branch_name: string
  whatsapp_number: string
  contact_information: string
  address: string
  opening_hours: string
  takeaway_enabled: boolean
  delivery_enabled: boolean
  delivery_address_required: boolean
  delivery_fee: number
  customer_phone_required: boolean
  public_information: string
}

export interface CartItem {
  productId: string
  quantity: number
}

export interface CheckoutDetails {
  customerName: string
  customerPhone: string
  orderType: 'takeaway' | 'delivery'
  address: string
  notes: string
}

export const defaultSettings: StoreSettings = {
  id: 1,
  store_name: 'Rocket Chicken',
  branch_name: 'KS Tubun Purwokerto',
  whatsapp_number: '',
  contact_information: '',
  address: '',
  opening_hours: '',
  takeaway_enabled: true,
  delivery_enabled: true,
  delivery_address_required: true,
  delivery_fee: 0,
  customer_phone_required: false,
  public_information: '',
}
