require('dotenv').config({ path: '.env.local' });

const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
const targetNumber = 'phone:+528110182368';

async function run() {
  const url = `https://api.respond.io/v2/contact/${encodeURIComponent(targetNumber)}/message/list`;
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
  console.log("Messages:", JSON.stringify(data.items.slice(0, 5), null, 2));
}
run();
