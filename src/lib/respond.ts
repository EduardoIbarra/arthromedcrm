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

