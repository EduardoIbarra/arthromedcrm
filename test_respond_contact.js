require('dotenv').config({ path: '.env.local' });

const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
const targetNumber = 'phone:+528110182368';

async function run() {
  const url = `https://api.respond.io/v2/contact/${encodeURIComponent(targetNumber)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
      'Accept': 'application/json'
    }
  });
  
  console.log("Status:", res.status);
  console.log("Contact:", await res.text());
}
run();
