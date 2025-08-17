require('dotenv').config();
const express = require('express');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('public'));

async function coletarDados(origem, destino, dataIda, dataVolta) {
  console.log(`Iniciando scraping: ${origem} -> ${destino} (${dataIda} a ${dataVolta})`);

  const browser = await puppeteer.launch({
    headless: chromium.headless,
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: { width: 1366, height: 900 }
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/127.0.0.0 Safari/537.36'
  );

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
  });

  try {
    // Monta URL de pesquisa (ajuste conforme o formato real da LATAM)
    const urlBusca = `https://www.latamairlines.com/br/pt/ofertas-voos?origin=${origem}&destination=${destino}&outbound=${dataIda}&inbound=${dataVolta}&cabins=Y`;
    await page.goto(urlBusca, { waitUntil: 'networkidle2', timeout: 0 });

    await page.waitForSelector('.flight-information', { timeout: 20000 });

    const voos = await page.evaluate(() => {
      const lista = [];
      document.querySelectorAll('.flight-information').forEach(voo => {
        const origem = voo.querySelector('.departure .city')?.innerText || null;
        const horarioOrigem = voo.querySelector('.departure .time')?.innerText || null;
        const destino = voo.querySelector('.arrival .city')?.innerText || null;
        const horarioDestino = voo.querySelector('.arrival .time')?.innerText || null;
        const preco = voo.querySelector('.price-amount')?.innerText || null;

        lista.push({ origem, horarioOrigem, destino, horarioDestino, preco });
      });
      return lista;
    });

    return { voos, status: 'OK' };
  } catch (erro) {
    console.error('Erro no scraping:', erro);
    return { erro: erro.message, status: 'FAIL' };
  } finally {
    await browser.close();
  }
}

app.get('/', (req, res) => {
  res.send('Servidor de automação está rodando 🚀');
});

app.get('/scraping', async (req, res) => {
  const { origem, destino, dataIda, dataVolta } = req.query;

  if (!origem || !destino || !dataIda) {
    return res.json({
      erro: 'Parâmetros obrigatórios: origem, destino, dataIda (YYYY-MM-DD) e opcional dataVolta'
    });
  }

  const resultado = await coletarDados(origem, destino, dataIda, dataVolta);
  res.json(resultado);
});

app.listen(PORT, () => {
  console.log(`Interface disponível em http://localhost:${PORT}`);
});
