import { Client } from 'whatsapp-web.js';

async function run() {
  const client = new Client({
    puppeteer: { headless: true, args: ['--no-sandbox'] }
  });

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
  });

  client.on('ready', () => {
    console.log('Client is ready!');
    process.exit(0);
  });

  console.log("Initializing...");
  client.initialize();

  // Wait 5 seconds, then request pairing code
  setTimeout(async () => {
    console.log("Requesting code...");
    try {
      const code = await client.requestPairingCode('5522981310965');
      console.log('PAIRING CODE:', code);
      process.exit(0);
    } catch(err) {
      console.error(err);
      process.exit(1);
    }
  }, 10000);
}

run();
