// index.js
require('dotenv').config();
const express = require('express');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware para servir arquivos estáticos (se tiver frontend)
app.use(express.static('public'));

// Função de scraping
async function coletarDados() {
  console.log('Iniciando scraping...');

  const browser = await puppeteer.launch({
    headless: chromium.headless,
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: { width: 1366, height: 900 }
  });

  const page = await browser.newPage();

  try {
    // Exemplo: acessar página da LATAM
    await page.goto('https://www.latamairlines.com/', {
      waitUntil: 'networkidle2',
      timeout: 0
    });

    // Aqui você coloca seus seletores e lógica de captura de dados
    // Exemplo:
    const titulo = await page.title();

    console.log('Título da página:', titulo);

    // Retorne o que quiser para a rota
    return { titulo, status: 'OK' };
  } catch (erro) {
    console.error('Erro no scraping:', erro);
    return { erro: erro.message, status: 'FAIL' };
  } finally {
    await browser.close();
  }
}

// Rota principal
app.get('/', (req, res) => {
  res.send('Servidor de automação está rodando 🚀');
});

// Rota de scraping
app.get('/scraping', async (req, res) => {
  const resultado = await coletarDados();
  res.json(resultado);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Interface disponível em http://localhost:${PORT}`);
});
