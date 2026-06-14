fetch('https://sistema-jose-giro-api-server.vercel.app/api/whatsapp/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ number: '5522981310965' })
})
.then(r => r.text())
.then(console.log)
.catch(console.error);
