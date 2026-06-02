require('dotenv').config({ path: '.env.local' });

const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID;

async function run() {
  // Let's get the messages for this contact to see the status of the last message sent
  const targetNumber = 'phone:+528110182368';
  const url = `https://api.respond.io/v2/contact/${encodeURIComponent(targetNumber)}/message`;
  const res = await fetch(url, {
    method: 'GET',
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
  console.log("Messages:", JSON.stringify(data.items.slice(0, 3), null, 2));
}
run();
