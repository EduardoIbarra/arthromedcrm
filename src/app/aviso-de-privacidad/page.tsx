'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Globe, ArrowLeft, Lock, Database, Mail } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type Language = 'es' | 'en' | 'zh'

const CONTENT = {
  es: {
    title: 'Aviso de Privacidad',
    subtitle: 'Su privacidad es nuestra prioridad',
    lastUpdated: 'Última actualización: Mayo 2026',
    sections: [
      {
        icon: <Database size={20} />,
        title: '1. Información que recopilamos',
        content: 'En Arthromed recopilamos información personal que usted nos proporciona voluntariamente al registrarse en nuestros congresos, simposios o al interactuar con nuestras plataformas. Esta información incluye: nombre completo, rol profesional (médico especialista o distribuidor), especialidad médica, hospital o institución donde ejerce, número de teléfono (WhatsApp) y estado de residencia.'
      },
      {
        icon: <Lock size={20} />,
        title: '2. Uso de su información',
        content: 'Utilizamos su información personal exclusivamente para los siguientes fines: procesar su registro y acceso a eventos médicos y talleres, enviarle información relevante sobre equipos y consumibles de alta especialidad, gestionar alianzas comerciales si aplica, y mejorar nuestros servicios y atención personalizada a través de nuestros asesores.'
      },
      {
        icon: <Shield size={20} />,
        title: '3. Protección y uso compartido',
        content: 'Sus datos son tratados con estricta confidencialidad. Arthromed no vende, alquila ni comparte su información personal con terceros no relacionados. Su información solo es accesible para nuestro equipo interno y asesores especializados con el propósito de brindarle un mejor servicio.'
      },
      {
        icon: <Mail size={20} />,
        title: '4. Sus derechos y contacto',
        content: 'Usted tiene derecho a acceder, rectificar, cancelar u oponerse al tratamiento de sus datos personales. Para ejercer estos derechos o si tiene alguna duda sobre este aviso de privacidad, puede contactarnos a través de los canales oficiales de comunicación o respondiendo a nuestros asesores vía WhatsApp.'
      }
    ]
  },
  en: {
    title: 'Privacy Policy',
    subtitle: 'Your privacy is our priority',
    lastUpdated: 'Last updated: May 2026',
    sections: [
      {
        icon: <Database size={20} />,
        title: '1. Information we collect',
        content: 'At Arthromed, we collect personal information that you voluntarily provide when registering for our congresses, symposiums, or interacting with our platforms. This information includes: full name, professional role (specialist doctor or distributor), medical specialty, hospital or institution where you practice, phone number (WhatsApp), and state of residence.'
      },
      {
        icon: <Lock size={20} />,
        title: '2. How we use your information',
        content: 'We use your personal information exclusively for the following purposes: processing your registration and access to medical events and workshops, sending you relevant information about high-specialty equipment and consumables, managing commercial alliances if applicable, and improving our services and personalized care through our advisors.'
      },
      {
        icon: <Shield size={20} />,
        title: '3. Protection and sharing',
        content: 'Your data is treated with strict confidentiality. Arthromed does not sell, rent, or share your personal information with unrelated third parties. Your information is only accessible to our internal team and specialized advisors for the purpose of providing you with better service.'
      },
      {
        icon: <Mail size={20} />,
        title: '4. Your rights and contact',
        content: 'You have the right to access, rectify, cancel, or oppose the processing of your personal data. To exercise these rights or if you have any questions about this privacy policy, you can contact us through our official communication channels or by replying to our advisors via WhatsApp.'
      }
    ]
  },
  zh: {
    title: '隐私政策',
    subtitle: '您的隐私是我们的首要任务',
    lastUpdated: '最后更新：2026年5月',
    sections: [
      {
        icon: <Database size={20} />,
        title: '1. 我们收集的信息',
        content: '在 Arthromed，我们收集您在注册我们的会议、研讨会或与我们的平台互动时自愿提供的个人信息。这些信息包括：全名、专业角色（专科医生或经销商）、医学专科、您执业的医院或机构、电话号码（WhatsApp）以及居住州。'
      },
      {
        icon: <Lock size={20} />,
        title: '2. 我们如何使用您的信息',
        content: '我们将您的个人信息专门用于以下目的：处理您的注册和医疗活动及研讨会的访问权限，向您发送有关高专科设备和耗材的相关信息，管理商业联盟（如适用），并通过我们的顾问改善我们的服务和个性化关怀。'
      },
      {
        icon: <Shield size={20} />,
        title: '3. 保护与共享',
        content: '您的数据受到严格保密。Arthromed 不会向无关的第三方出售、出租或共享您的个人信息。只有我们的内部团队和专业顾问才能访问您的信息，以便为您提供更好的服务。'
      },
      {
        icon: <Mail size={20} />,
        title: '4. 您的权利与联系方式',
        content: '您有权访问、更正、取消或反对处理您的个人数据。如果您想行使这些权利，或者对本隐私政策有任何疑问，可以通过我们的官方沟通渠道或通过 WhatsApp 回复我们的顾问来联系我们。'
      }
    ]
  }
}

export default function PrivacyPolicyPage() {
  const router = useRouter()
  const [lang, setLang] = useState<Language>('es')
  const content = CONTENT[lang]

  return (
    <div className="min-h-[100dvh] bg-[#f8fafd] relative overflow-hidden flex flex-col items-center">
      {/* Background decorative elements */}
      <div className="fixed rounded-full blur-[100px] opacity-40 pointer-events-none z-0 w-[500px] h-[500px] bg-gradient-to-br from-[#cce0f5] to-[#e8f1f9] -top-40 -right-40" />
      <div className="fixed rounded-full blur-[100px] opacity-30 pointer-events-none z-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#d4e0ec] to-[#f0f5fa] -bottom-20 -left-20" />

      {/* Header */}
      <header className="w-full relative z-10 bg-white/80 backdrop-blur-md border-b border-[#e8f1f9] py-4 px-6 flex items-center justify-between shadow-sm shadow-[#0763a9]/5">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-[#5a5b5d] hover:text-[#0763a9] transition-colors bg-[#f0f5fa] p-2 rounded-xl hover:bg-[#e8f1f9]">
            <ArrowLeft size={20} />
          </button>
          <Image
            src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
            alt="Arthromed Logo"
            width={140}
            height={45}
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-1 bg-[#f0f5fa] p-1 rounded-xl border border-[#d4e0ec]">
          <Globe size={14} className="ml-2 text-[#8a8b8d] hidden sm:block" />
          {(['es', 'en', 'zh'] as Language[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === l
                ? 'bg-white text-[#0763a9] shadow-sm shadow-[#0763a9]/10'
                : 'text-[#8a8b8d] hover:text-[#37383a]'
                }`}
            >
              {l === 'es' ? 'ES' : l === 'en' ? 'EN' : '中文'}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-3xl relative z-10 px-4 py-12 flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#e8f1f9] text-[#0763a9] rounded-2xl mb-6 shadow-sm shadow-[#0763a9]/10">
            <Shield size={32} />
          </div>
          <AnimatePresence mode="wait">
            <motion.h1
              key={`title-${lang}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-3xl md:text-5xl font-extrabold text-[#37383a] tracking-tight mb-4"
            >
              {content.title}
            </motion.h1>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p
              key={`subtitle-${lang}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-lg text-[#5a5b5d] font-medium"
            >
              {content.subtitle}
            </motion.p>
          </AnimatePresence>
          <p className="text-xs text-[#8a8b8d] mt-2 font-medium tracking-wide uppercase">{content.lastUpdated}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-[#d4e0ec] rounded-3xl p-6 md:p-10 shadow-xl shadow-[#0763a9]/5"
        >
          <div className="flex flex-col gap-10">
            {content.sections.map((section, index) => (
              <AnimatePresence mode="wait" key={`section-${index}`}>
                <motion.div
                  key={`content-${lang}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex flex-col gap-3"
                >
                  <h2 className="text-xl font-bold text-[#37383a] flex items-center gap-3 border-b border-[#f0f5fa] pb-3">
                    <span className="text-[#0763a9] bg-[#e8f1f9] p-2 rounded-xl">
                      {section.icon}
                    </span>
                    {section.title}
                  </h2>
                  <p className="text-[#5a5b5d] leading-relaxed mt-1 text-sm md:text-base">
                    {section.content}
                  </p>
                </motion.div>
              </AnimatePresence>
            ))}
          </div>
        </motion.div>

        {/* Footer info */}
        <div className="text-center pb-8 pt-4">
          <p className="text-[#8a8b8d] text-sm">© 2026 Arthromed ERP</p>
        </div>
      </main>
    </div>
  )
}
