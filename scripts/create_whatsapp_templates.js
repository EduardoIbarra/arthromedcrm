require('dotenv').config({ path: '.env.local' });

const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID;

async function createTemplate(name, text) {
  const url = `https://api.respond.io/v2/space/channel/${RESPOND_CHANNEL_ID}/template`;
  const payload = {
    name: name,
    language: "es",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: text
      }
    ]
  };

  console.log(`Creating template ${name}...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error(`Failed to create ${name}:`, res.status, await res.text());
  } else {
    const data = await res.json();
    console.log(`Success ${name}:`, data);
  }
}

async function run() {
  if (!RESPOND_API_TOKEN || !RESPOND_CHANNEL_ID) {
    console.error("Missing API tokens");
    return;
  }
  
  await createTemplate(
    "payment_reminder_3_days",
    "Hola, te recordamos que tu fecha de pago será en 3 días."
  );

  await createTemplate(
    "payment_overdue_polite",
    "Hola, esperamos que te encuentres muy bien. Te escribimos para recordarte amablemente que tu pago venció el día de ayer."
  );
}

run();
