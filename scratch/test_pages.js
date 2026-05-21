const puppeteer = require('c:\\Users\\kjvtr\\OneDrive\\Área de Trabalho\\pen drive lucas carro\\Sistema-Jose-Giro-Faisca\\node_modules\\puppeteer');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log("Iniciando Puppeteer com Chrome local...");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Escutar logs do console
  page.on('console', msg => {
    console.log(`[PAGE CONSOLE ${msg.type().toUpperCase()}]: ${msg.text()}`);
  });

  // Escutar erros não capturados na página
  page.on('pageerror', err => {
    console.error(`[PAGE RUNTIME ERROR]:`, err.toString());
  });

  try {
    console.log("Navegando para o Login...");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    
    console.log("Preenchendo formulário de login...");
    await page.waitForSelector('#login');
    await page.type('#login', 'admin');
    await page.type('#senha', 'admin');
    
    console.log("Clicando no botão de login...");
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    console.log("Login efetuado. URL atual:", page.url());
    
    // Screenshot do Dashboard
    await page.screenshot({ path: 'scratch/dashboard.png' });
    console.log("Screenshot do Dashboard salvo em scratch/dashboard.png");

    // Navegar para Diários
    console.log("Navegando para /diarios...");
    await page.goto('http://localhost:3000/diarios', { waitUntil: 'networkidle2' });
    console.log("URL atual:", page.url());
    await page.screenshot({ path: 'scratch/diarios.png' });
    console.log("Screenshot de Diários salvo em scratch/diarios.png");

    // Obter todas as turmas/links exibidos na tela
    const turmas = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links
        .map(l => ({ text: l.innerText, href: l.getAttribute('href') }))
        .filter(l => l.href && l.href.includes('/diarios/'));
    });
    console.log("Turmas/Links de Diários encontrados:", JSON.stringify(turmas, null, 2));

    if (turmas.length > 0) {
      const primeiroDiarioUrl = 'http://localhost:3000' + turmas[0].href;
      console.log(`Navegando para o primeiro diário: ${primeiroDiarioUrl}...`);
      await page.goto(primeiroDiarioUrl, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: 'scratch/diario_turma.png' });
      console.log("Screenshot do Diário de Turma salvo em scratch/diario_turma.png");

      // Tentar abrir o modal de abono (se o botão existir)
      console.log("Verificando se botão de abono existe...");
      const botaoAbonoId = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const target = buttons.find(b => b.innerText.includes('Compensar Faltas') || b.innerText.includes('Abonar'));
        if (target) {
          target.click();
          return true;
        }
        return false;
      });
      
      if (botaoAbonoId) {
        console.log("Clicou no botão de abono! Esperando 2 segundos para renderizar o modal...");
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: 'scratch/diario_turma_abono_modal.png' });
        console.log("Screenshot do Modal de Abono salvo.");
      } else {
        console.log("Botão de compensação/abono de faltas não encontrado ou não visível.");
      }
    }

    // Navegar para Robô Local
    console.log("Navegando para /robo-local...");
    await page.goto('http://localhost:3000/robo-local', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'scratch/robo_local.png' });
    console.log("Screenshot de /robo-local salvo em scratch/robo_local.png");

  } catch (error) {
    console.error("Erro durante a execução do teste:", error);
  } finally {
    await browser.close();
    console.log("Browser fechado.");
  }
}

run();
