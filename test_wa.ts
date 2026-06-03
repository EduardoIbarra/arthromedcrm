async function run() {
  const payload = {
    to: '8118640700', // A dummy number or I'll just see what respond.io returns
    template: 'congress_welcome_custom',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Dr. Test' },
          { type: 'text', text: 'Equipo Arthromed' }
        ]
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          { type: 'text', text: 'congresos/test/landing?greeting=Hola' }
        ]
      }
    ]
  }

  const res = await fetch('http://localhost:3000/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  console.log(res.status)
  console.log(await res.text())
}

run()
