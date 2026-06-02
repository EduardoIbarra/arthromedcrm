require('dotenv').config({ path: '.env.local' });

const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID;

async function run() {
  console.log("Token starts with:", RESPOND_API_TOKEN ? RESPOND_API_TOKEN.substring(0, 10) : "null");
  console.log("Channel:", RESPOND_CHANNEL_ID);
  
  const url = `https://api.respond.io/v2/space/channel/${RESPOND_CHANNEL_ID}/template`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
      'Accept': 'application/json'
    }
  });
  
  if (!res.ok) {
    console.error("Failed", res.status, await res.text());
    return;
  }
  
  const data = await res.json();
  console.log("Templates:", JSON.stringify(data, null, 2));
}
run();
