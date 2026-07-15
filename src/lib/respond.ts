import prisma from '@/lib/prisma';

export async function sendInternalNotification(message: string, moduleName?: string) {
  const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
  const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID;

  if (!RESPOND_API_TOKEN) {
    console.warn('RESPOND_API_TOKEN is not set. Skipping respond.io notification.');
    return;
  }

  try {
    let targetNumbers = ['8110182368']; // Default fallback if not configured

    if (moduleName) {
      const settings = await prisma.app_settings.findUnique({
        where: { key: 'notification_config' }
      });

      if (settings?.value && typeof settings.value === 'object' && !Array.isArray(settings.value)) {
        const config = settings.value as Record<string, string[]>;
        const userIds = config[moduleName];
        
        if (userIds && Array.isArray(userIds) && userIds.length > 0) {
          const users = await prisma.user_profiles.findMany({
            where: {
              id: { in: userIds },
              whatsapp: { not: null }
            },
            select: { whatsapp: true }
          });
          
          if (users.length > 0) {
            targetNumbers = users.map((u: { whatsapp: string | null }) => u.whatsapp!).filter(Boolean);
          }
        }
      }
    }

    const payload: any = {
      message: {
        type: 'text',
        text: message,
      },
    };

    if (RESPOND_CHANNEL_ID) {
      payload.channelId = parseInt(RESPOND_CHANNEL_ID, 10);
    }

    // Send notifications to all configured numbers in parallel
    const promises = targetNumbers.map(async (num) => {
      // Basic formatter: ensure +52 for Mexico if not supplied with a country code
      const cleanNum = num.replace(/\\s+/g, '');
      const formattedNum = cleanNum.startsWith('+') ? cleanNum : `+52${cleanNum}`;
      const targetNumber = `phone:${formattedNum}`;
      
      const response = await fetch(`https://api.respond.io/v2/contact/${targetNumber}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'ERP-Arthromed/1.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to send respond.io message to ${targetNumber}: ${response.status} ${errorText}`);
      } else {
        console.log(`Successfully sent notification to respond.io (${targetNumber})`);
      }
    });

    await Promise.allSettled(promises);
  } catch (error) {
    console.error('Error sending message to respond.io:', error);
  }
}

export async function sendNotificationToUser(userId: string, message: string) {
  const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
  const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID;

  if (!RESPOND_API_TOKEN) {
    console.warn('RESPOND_API_TOKEN is not set. Skipping respond.io notification.');
    return;
  }

  try {
    const user = await prisma.user_profiles.findUnique({
      where: { id: userId },
      select: { whatsapp: true }
    });

    if (!user || !user.whatsapp) {
      console.warn(`User ${userId} does not have a whatsapp number configured.`);
      return;
    }

    const payload: any = {
      message: {
        type: 'text',
        text: message,
      },
    };

    if (RESPOND_CHANNEL_ID) {
      payload.channelId = parseInt(RESPOND_CHANNEL_ID, 10);
    }

    const cleanNum = user.whatsapp.replace(/\s+/g, '');
    const formattedNum = cleanNum.startsWith('+') ? cleanNum : `+52${cleanNum}`;
    const targetNumber = `phone:${formattedNum}`;
    
    const response = await fetch(`https://api.respond.io/v2/contact/${targetNumber}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ERP-Arthromed/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send respond.io message to ${targetNumber}: ${response.status} ${errorText}`);
    } else {
      console.log(`Successfully sent direct notification to respond.io (${targetNumber})`);
    }
  } catch (error) {
    console.error('Error sending direct message to respond.io:', error);
  }
}

export async function sendRespondMessage(targetPhone: string, messagePayload: any): Promise<boolean> {
  const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
  const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID;

  if (!RESPOND_API_TOKEN) {
    console.warn('RESPOND_API_TOKEN is not set. Skipping respond.io message.');
    return false;
  }

  // Ensure + sign in the phone
  const cleanPhone = targetPhone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`;
  const targetNumber = `phone:+${formattedPhone}`;

  const payload: any = {
    message: messagePayload
  };

  if (RESPOND_CHANNEL_ID) {
    payload.channelId = parseInt(RESPOND_CHANNEL_ID, 10);
  }

  try {
    const response = await fetch(`https://api.respond.io/v2/contact/${encodeURIComponent(targetNumber)}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ERP-Arthromed/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send respond.io message to ${targetNumber}: ${response.status} ${errorText}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending message to respond.io:', error);
    return false;
  }
}

export async function getStaffNumbersForLetters(): Promise<string[]> {
  try {
    const configSetting = await prisma.app_settings.findUnique({
      where: { key: 'notification_config' }
    });
    if (!configSetting?.value || typeof configSetting.value !== 'object') {
      return [];
    }
    const value = configSetting.value as any;
    const userIds = value.cartas_distribucion;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return [];
    }
    const users = await prisma.user_profiles.findMany({
      where: {
        id: { in: userIds },
        whatsapp: { not: null }
      },
      select: { whatsapp: true }
    });
    return users.map((u: any) => u.whatsapp).filter(Boolean) as string[];
  } catch (error) {
    console.error('Error fetching notification staff:', error);
    return [];
  }
}

export async function notifyStaffNewSolicitud(
  solicitud: any, 
  clientName: string, 
  clientRfc: string, 
  userEmail: string
) {
  const staffNumbers = await getStaffNumbersForLetters();
  if (staffNumbers.length === 0) return;
  const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
  const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID;
  const payload = {
    channelId: RESPOND_CHANNEL_ID ? parseInt(RESPOND_CHANNEL_ID, 10) : undefined,
    message: {
      type: 'whatsapp_template',
      template: {
        name: 'distribuition_letter_staff',
        languageCode: 'es_MX',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: clientName }, // {{1}} Empresa
              { type: 'text', text: clientRfc || 'Sin RFC' }, // {{2}} RFC
              { type: 'text', text: userEmail.split('@')[0] }, // {{3}} Solicitado por
              { type: 'text', text: userEmail }, // {{4}} Email
              { type: 'text', text: solicitud.hospital }, // {{5}} Hospital Destino
              { type: 'text', text: solicitud.hospital_email || '-' }, // {{6}} Email Hospital
              { type: 'text', text: solicitud.hospital_phone || '-' }, // {{7}} Teléfono Hospital
              { type: 'text', text: solicitud.lineas_producto.join(', ') }, // {{8}} Líneas de producto
              { type: 'text', text: solicitud.estados.join(', ') }, // {{9}} Cobertura
              { type: 'text', text: 'https://erp.arthromed.com.mx/cartas-distribuidor' } // {{10}} Link ERP
            ]
          }
        ]
      }
    }
  };
  
  await Promise.allSettled(
    staffNumbers.map(async (num) => {
      const cleanNum = num.replace(/\D/g, '');
      const phone = cleanNum.startsWith('52') ? cleanNum : `52${cleanNum}`;
      const target = `phone:+${phone}`;
      await fetch(`https://api.respond.io/v2/contact/${encodeURIComponent(target)}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload)
      });
    })
  );
}

export async function notifyClientSolicitudUpdate(
  clientWhatsapp: string,
  clientContactName: string,
  solicitud: any,
  statusLabel: string, // "Pendiente", "Aprobada", "Rechazada"
  additionalNotes: string // Comments or reason of rejection
) {
  if (!clientWhatsapp) return;
  const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
  const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID;
  const cleanNum = clientWhatsapp.replace(/\D/g, '');
  const phone = cleanNum.startsWith('52') ? cleanNum : `52${cleanNum}`;
  const target = `phone:+${phone}`;
  const payload = {
    channelId: RESPOND_CHANNEL_ID ? parseInt(RESPOND_CHANNEL_ID, 10) : undefined,
    message: {
      type: 'whatsapp_template',
      template: {
        name: 'distribuition_letter_client',
        languageCode: 'es_MX',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: clientContactName }, // {{1}} Hola {{1}}
              { type: 'text', text: solicitud.hospital }, // {{2}} Hospital de Destino
              { type: 'text', text: statusLabel }, // {{3}} Estado actual
              { type: 'text', text: additionalNotes }, // {{4}} Comentarios / Notas
              { type: 'text', text: 'https://cliente.arthromed.com.mx/distributor-letter' } // {{5}} Link Portal
            ]
          }
        ]
      }
    }
  };
  await fetch(`https://api.respond.io/v2/contact/${encodeURIComponent(target)}/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload)
  });
}

