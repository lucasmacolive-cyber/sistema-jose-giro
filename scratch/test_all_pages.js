const puppeteer = require('c:\\Users\\kjvtr\\OneDrive\\Área de Trabalho\\pen drive lucas carro\\Sistema-Jose-Giro-Faisca\\node_modules\\puppeteer');

async function run() {
  console.log("Iniciando Puppeteer para testar TODAS as rotas...");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', err => {
    console.error(`[CRITICAL PAGE ERROR]:`, err.toString());
    errors.push({ url: page.url(), error: err.toString() });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[PAGE CONSOLE ERROR]: ${msg.text()}`);
    }
  });

  try {
    console.log("Efetuando login...");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login');
    await page.type('#login', 'admin');
    await page.type('#senha', 'admin');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    const routes = [
      '/',
      '/turmas',
      '/alunos',
      '/notas-presencas',
      '/professores',
      '/funcionarios',
      '/impressoes',
      '/impressao-atividades-giro',
      '/documentos',
      '/listagens',
      '/sync',
      '/arquivo-morto',
      '/transferidos',
      '/ponto',
      '/diarios',
      '/diarios/compensacao-ausencia',
      '/calendario',
      '/robo-local'
    ];

    for (const route of routes) {
      const url = `http://localhost:3000${route}`;
      console.log(`Testando rota: ${route}...`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1000)); // Esperar 1 segundo para garantir renderização e capturar erros assíncronos
      
      // Se estivermos na página de alunos, vamos tentar capturar um link para o perfil de um aluno
      if (route === '/alunos') {
        const alunoHref = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const profileLink = links.find(l => l.getAttribute('href') && l.getAttribute('href').startsWith('/alunos/'));
          return profileLink ? profileLink.getAttribute('href') : null;
        });
        if (alunoHref) {
          console.log(`Testando rota dinâmica de perfil de aluno: ${alunoHref}...`);
          await page.goto(`http://localhost:3000${alunoHref}`, { waitUntil: 'networkidle2' });
          await new Promise(r => setTimeout(r, 1000));
        } else {
          console.log("Nenhum link de perfil de aluno encontrado para testar.");
        }
      }

      // Se estivermos na página de notas-presencas, vamos tentar capturar um link para notas de aluno
      if (route === '/notas-presencas') {
        const notaHref = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const link = links.find(l => l.getAttribute('href') && l.getAttribute('href').startsWith('/notas-presencas/'));
          return link ? link.getAttribute('href') : null;
        });
        if (notaHref) {
          console.log(`Testando rota dinâmica de notas do aluno: ${notaHref}...`);
          await page.goto(`http://localhost:3000${notaHref}`, { waitUntil: 'networkidle2' });
          await new Promise(r => setTimeout(r, 1000));
        } else {
          console.log("Nenhum link de notas/presenças de aluno encontrado para testar.");
        }
      }
    }

    console.log("\n--- RESULTADO DOS TESTES ---");
    if (errors.length === 0) {
      console.log("Sucesso! Nenhuma tela azul ou erro em tempo de execução foi detectado em nenhuma das rotas.");
    } else {
      console.log(`Falha! Foram detectados ${errors.length} erros:`);
      errors.forEach(e => {
        console.log(`- URL: ${e.url}\n  Erro: ${e.error}`);
      });
    }

  } catch (error) {
    console.error("Erro inesperado no script de teste:", error);
  } finally {
    await browser.close();
    console.log("Browser fechado.");
  }
}

run();
