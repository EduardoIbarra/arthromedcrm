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
  notes: string | null
  tags: string[] | null
  assigned_to: string | null
  last_contact_at: string | null
  distributor_id: string | null
  letter_created_at: string | null
  letter_expires_at: string | null
  letter_url: string | null
  updated_at: string
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
  alg_description: string | null
  sale_price: number | null
  base_hospital_price: number | null
  line: string | null
  type: string | null
  created_at: string
  updated_at: string
}

export interface Hospital {
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

// No longer exporting Database type since we use untyped client
export type Database = Record<string, unknown>
