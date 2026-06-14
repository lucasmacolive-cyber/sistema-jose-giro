import { generateWhatsAppPairing } from './src/lib/whatsapp-baileys.js';

async function run() {
  try {
    console.log("Generating...");
    await generateWhatsAppPairing('5522981310965');
    console.log("Success");
  } catch (err) {
    console.error("Error generating:", err);
  }
  process.exit(0);
}

run();
