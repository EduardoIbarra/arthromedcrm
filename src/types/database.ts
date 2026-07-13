export type ClientStatus = 'Nuevo Prospecto' | 'Contactado' | 'Calificado' | 'Negociación' | 'Activo' | 'Inactivo' | 'Perdido'
export type ActivityType = 'whatsapp' | 'llamada' | 'email' | 'nota' | 'visita' | 'sistema'

export interface Client {
  id: string
  created_at: string
  registered_at: string | null
  name: string
  rfc: string | null
  zip_code: string | null
  fiscal_address: string | null
  email_primary: string | null
  email_billing: string | null
  email_contact: string | null
  phone: string | null
  whatsapp_phone: string | null
  states: string[] | null
  hospitals: string[] | null
  specialties: string[] | null
  tax_regime: string | null
  status: ClientStatus
  source: string | null
  legal_representative: string | null
  notes: string | null
  tags: string[] | null
  assigned_to: string | null
  last_contact_at: string | null
  distributor_id: string | null
  letter_created_at: string | null
  letter_expires_at: string | null
  letter_url: string | null
  avatar_url?: string | null
  addresses?: { name: string; address: string; zip_code?: string | null; is_dhl?: boolean }[] | null
  updated_at: string
  // Enriched from facturas_cliente (RFC/name match)
  latest_payment_date?: string | null
  last_purchase_date?: string | null
  last_factura_id?: string | null
  last_factura_numero?: string | null
  cartas_count?: number
}

// All fields optional except name — easy to use for inserts/imports
export type ClientInsert = Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>> & {
  name: string
}

export type ClientUpdate = Partial<Client>

export interface ClientActivity {
  id: string
  client_id: string
  type: ActivityType
  content: string | null
  created_at: string
  created_by: string | null
}

export type ClientActivityInsert = Omit<ClientActivity, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export interface ClientCustomField {
  id: string
  client_id: string
  field_name: string
  field_value: string | null
  created_at: string
}

export interface Product {
  id: string
  description: string
  model: string | null
  order_code: string | null
  invoice_concept: string | null
  generic_description: string | null
  new_alg_description: string | null
  measurements: string | null
  measurement_unit?: 'cm' | 'in' | 'mm' | null
  height?: number | null
  width?: number | null
  depth?: number | null
  weight?: number | null
  purchase_price?: number | null
  alg_description: string | null
  sale_price: number | null
  base_hospital_price: number | null
  line: string | null
  type: string | null
  subtipo: string | null
  category: string | null
  specialty_ids: string[] | null
  image_urls: string[] | null
  alegra_id: string | null
  orden: number | null
  line_color?: string | null
  nombre_lista?: string | null
  created_at: string
  updated_at: string
}

export interface Hospital {
  id: string
  name: string
  created_at: string
  updated_at: string
  notes?: string
  admission_process?: string
  billing_process?: string
  group_id?: string
}

export interface HospitalGroup {
  id: string
  name: string
  created_at: string
  updated_at: string
}


export interface HospitalPrice {
  id: string
  product_id: string
  hospital_id: string
  price: number
  pending: boolean
  created_at: string
  updated_at: string
}

export interface Congreso {
  id: string
  name: string
  start_date: string
  end_date: string
  location: string
  description: string
  flyer: string | null
  specialty_ids: string[] | null
  video_urls: string[] | null
  created_at: string
  updated_at: string
  workshops?: Workshop[]
  contacts?: Contact[]
}

export interface Doctor {
  id: string
  name: string
  specialty_ids: string[] | null
  country: string | null
  avatar_url: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WorkshopDoctor {
  workshop_id: string
  doctor_id: string
  workshop?: Workshop
  doctor?: Doctor
}

export interface Workshop {
  id: string
  congress_id: string | null
  name: string
  date_time: string
  max_people: number
  cost: number | null
  professor: string
  doctors?: WorkshopDoctor[]
}

export interface Contact {
  id: string
  congress_id: string
  name: string
  number: string | null
  email: string | null
}

export type CongresoInsert = Omit<Congreso, 'id' | 'created_at' | 'updated_at' | 'workshops' | 'contacts'> & {
  id?: string
}

export interface CongresoFile {
  id: string
  congreso_id: string
  name: string
  url: string
  file_type: string | null
  size_bytes: number | null
  created_at: string
}

export interface Gasto {
  id: string
  name: string
  description: string | null
  amount: number
  iva_percent: number
  iva: number
  total: number
  comments: string | null
  card: string | null
  congress_id: string | null
  category_id: string | null
  is_billable: boolean
  is_billed?: boolean
  folio_fiscal?: string | null
  invoice_url?: string | null
  expense_date?: string | null
  category?: { id?: string; name: string }
  created_at: string
  updated_at: string
}

export interface GastoAttachment {
  id: string
  gasto_id: string
  name: string
  url: string
  created_at: string
}

export type GastoInsert = Omit<Gasto, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  permissions: Record<string, string[]>
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  position: string | null
  whatsapp: string | null
  client_id?: string | null
  role: 'superadmin' | 'admin' | 'user'
  role_id: string | null
  roles?: Role // For joined queries
  permission_overrides: Record<string, string[]>
  created_at: string
  updated_at: string
}

export interface Evento {
  id: string
  nombre: string
  tipo: string // 'cirugia' | 'workshop' | 'actividad' | 'otro'
  fecha_inicio: string
  fecha_fin: string | null
  ubicacion: string | null
  responsable: string | null
  presupuesto: number | null
  estado: string // 'planificado' | 'realizado' | 'cancelado'
  descripcion: string | null
  created_by: string | null
  created_at: string | null
}

export type EventoInsert = Omit<Evento, 'id' | 'created_at' | 'created_by'> & {
  id?: string
}

export type Database = Record<string, unknown>

export interface CarFleet {
  id: string
  alias: string | null
  make: string
  model: string
  year: number
  plate_number: string
  color: string | null
  status: 'available' | 'in_use' | 'maintenance' | string
  notes: string | null
  assigned_to_id: string | null
  assigned_to?: UserProfile | null
  created_at: string
  updated_at: string
}

export interface WorkshopMember {
  workshop_id: string
  user_id: string
  car_id?: string | null
  user_profiles?: UserProfile
  car_fleet?: CarFleet | null
}

export interface WorkshopItineraryMember {
  itinerary_id: string
  user_id: string
  user_profiles?: UserProfile
}

export interface WorkshopItinerary {
  id: string
  workshop_id: string
  date: string
  time: string | null
  description: string
  notes: string | null
  involved_members?: { user_profiles: UserProfile }[]
  created_at?: string
  updated_at?: string
}

export interface DirectorioCategoria {
  id: string
  name: string
  created_at?: string | null
  contacts?: DirectorioContacto[]
}

export interface DirectorioContacto {
  id: string
  category_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at?: string | null
  category?: DirectorioCategoria
}

export interface PurchaseOrder {
  id: string
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL'
  notes?: string | null
  created_at: string
  updated_at: string
  numero_orden?: string
  proveedor?: string
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  created_at?: string
  updated_at?: string
  productos?: Product
}

export type PurchaseOrderInsert = Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'items'> & { id?: string }
export type PurchaseOrderItemInsert = Omit<PurchaseOrderItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }
