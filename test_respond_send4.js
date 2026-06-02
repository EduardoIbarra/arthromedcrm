require('dotenv').config({ path: '.env.local' });

const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
const RESPOND_CHANNEL_ID = parseInt(process.env.RESPOND_CHANNEL_ID, 10);

async function run() {
  const targetNumber = 'phone:+528110182368';
  
  const payload = {
    channelId: RESPOND_CHANNEL_ID,
    message: {
      type: 'whatsapp_template',
      template: {
        name: 'arthromed_welcome_register',
        languageCode: 'es_MX',
        components: [
          {
            type: 'body',
            parameters: [ { type: 'text', text: 'Dr. Test4' } ]
          }
        ]
      }
    }
  };

  const url = `https://api.respond.io/v2/contact/${encodeURIComponent(targetNumber)}/message`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  console.log("Status:", res.status);
  console.log("Response:", await res.text());
}
run();
