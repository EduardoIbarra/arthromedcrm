const RESPOND_API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjkwNDQsInNwYWNlSWQiOjQxNjYxNCwib3JnSWQiOjQwOTc5MywidHlwZSI6ImFwaSIsImlhdCI6MTc4MDI2NzA5MX0.3gEIGgZ6oLKgP8YobcMCoTxGpd_JD_0LXJnwacSoir0"

async function run() {
  if (!RESPOND_API_TOKEN) {
    console.log("No token in env")
    return
  }

  const phone = '528112492572'
  
  // 1. Create contact
  console.log("Creating contact...")
  const createRes = await fetch(`https://api.respond.io/v2/contact/phone:+${phone}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: '+' + phone,
      firstName: 'Test User 2'
    })
  })
  console.log("Create response:", createRes.status, await createRes.text())

  if (createRes.ok) {
    console.log("Waiting 3s for Respond.io queue...")
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  // 2. Send message
  console.log("Sending message...")
  const payload = {
    "channelId": 501682,
    "message": {
      "type": "whatsapp_template",
      "template": {
        "name": "congress_welcome_custom",
        "languageCode": "es_MX",
        "components": [
          {
            "type": "body",
            "parameters": [
              { "type": "text", "text": "Dr(a). Eduardo" },
              { "type": "text", "text": "Equipo Arthromed" }
            ]
          },
          {
            "type": "buttons",
            "buttons": [
              {
                "type": "url",
                "text": "Ver Información",
                "url": "https://erp.arthromed.com.mx/{{1}}",
                "parameters": [
                  { "type": "text", "text": "congresos/bc92989c-0ad5-43e7-849c-65fa8c25adc3/landing?clientId=65a17307-504b-40b1-b5f4-cc04c3404cce&greeting=Hola" }
                ]
              }
            ]
          }
        ]
      }
    }
  }

  const res = await fetch(`https://api.respond.io/v2/contact/phone:+${phone}/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  console.log("Send response:", res.status, await res.text())
}

run()
