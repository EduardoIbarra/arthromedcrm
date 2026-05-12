'use client'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/contexts/I18nContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Globe, Database, MessageCircle, Bot } from 'lucide-react'

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

function SettingCard({ icon, iconColor, title, children }: { icon: React.ReactNode; iconColor: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4 bg-white" style={CARD}>
      <div className="flex items-center gap-2">
        <span style={{ color: iconColor }}>{icon}</span>
        <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center p-2 rounded-lg" style={{ background: '#f8fafd' }}>
      <span className="text-sm" style={{ color: '#5a5b5d' }}>{label}</span>
      <span className="text-sm font-medium font-mono" style={{ color: '#37383a' }}>{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useI18n()

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('settings')}</h1>
          <p className="text-sm" style={{ color: '#5a5b5d' }}>Configuración del sistema</p>
        </div>

        <SettingCard icon={<Globe size={16} />} iconColor="#0763a9" title={t('language')}>
          <div className="flex items-center gap-4">
            <p className="text-sm" style={{ color: '#5a5b5d' }}>Idioma de la interfaz:</p>
            <LanguageSwitcher />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-1">
            {[
              { flag: '🇲🇽', name: t('spanish'), desc: 'Predeterminado' },
              { flag: '🇺🇸', name: t('english'), desc: 'English' },
              { flag: '🇨🇳', name: t('chinese'), desc: '中文' },
            ].map(l => (
              <div key={l.flag} className="flex flex-col items-center gap-1 p-3 rounded-xl border text-center" style={{ borderColor: '#e8f1f9', background: '#f8fafd' }}>
                <span className="text-2xl">{l.flag}</span>
                <p className="text-xs font-medium" style={{ color: '#37383a' }}>{l.name}</p>
                <p className="text-xs" style={{ color: '#8a8b8d' }}>{l.desc}</p>
              </div>
            ))}
          </div>
        </SettingCard>

        <SettingCard icon={<MessageCircle size={16} />} iconColor="#15803d" title="WhatsApp">
          <p className="text-sm" style={{ color: '#5a5b5d' }}>Plantillas aprobadas disponibles:</p>
          <div className="space-y-2">
            {[
              { id: 'lead_generic_followup', desc: 'Seguimiento genérico de lead' },
              { id: 'lead_onboarding_distributor', desc: 'Bienvenida a nuevo distribuidor' },
              { id: 'lead_referral_doctor', desc: 'Referido por médico' },
            ].map(tmpl => (
              <div key={tmpl.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl" style={{ border: '1px solid #e8f1f9', background: '#f8fafd' }}>
                <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0 pulse-dot" style={{ background: '#15803d' }} />
                <div>
                  <p className="text-sm font-mono" style={{ color: '#0763a9' }}>{tmpl.id}</p>
                  <p className="text-xs" style={{ color: '#8a8b8d' }}>{tmpl.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </SettingCard>

        <SettingCard icon={<Bot size={16} />} iconColor="#b45309" title="Inteligencia Artificial">
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ border: '1px solid #e8f1f9', background: '#f8fafd' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: '#37383a' }}>Gemini 2.0 Flash</p>
              <p className="text-xs" style={{ color: '#8a8b8d' }}>Modelo para resúmenes de clientes</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>Activo</span>
          </div>
        </SettingCard>

        <SettingCard icon={<Database size={16} />} iconColor="#0763a9" title="Base de Datos">
          <div className="space-y-2">
            <Row label="Proveedor" value="Supabase (PostgreSQL)" />
            <Row label="Proyecto" value="vogpviplsmupegohvbtl" />
            <Row label="Región" value="us-east-1" />
          </div>
        </SettingCard>
      </div>
    </AppShell>
  )
}
