// index.js
// Extrai preços da LATAM e exibe em uma interface web simples.

const puppeteer = require('puppeteer');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

let dadosExtraidos = 'Coleta ainda não realizada.';

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function aceitaCookiesSeAparecer(page) {
  try {
    const xpaths = [
      "//button[contains(., 'Aceitar')]",
      "//button[contains(., 'Aceito')]",
      "//button[contains(., 'Concordo')]",
      "//button[contains(., 'Accept')]"
    ];
    for (const xp of xpaths) {
      const [btn] = await page.$x(xp);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(800);
        break;
      }
    }
  } catch {}
}

async function extraiPrecosVisiveis(page) {
  const priceRegex = /(\bR\$|\bBRL)\s?\d{1,3}(\.\d{3})*,\d{2}/g;

  const offers = await page.evaluate((pricePattern) => {
    const data = [];
    const blocks = Array.from(document.querySelectorAll('section, article, li, div'));
    for (const node of blocks) {
      const text = (node.innerText || '').replace(/\s+\n/g, '\n').trim();
      if (!text) continue;
      const matches = text.match(new RegExp(pricePattern));
      if (matches && matches.length) {
        const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
        const header = lines.slice(0, 3).join(' | ').slice(0, 200);
        data.push({
          contexto: header,
          precos: Array.from(new Set(matches))
        });
      }
    }
    const seen = new Set();
    return data.filter(item => {
      const key = item.contexto + '|' + item.precos.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, priceRegex.source);

  const linhas = [];
  offers.forEach((of, idx) => {
    linhas.push(`Oferta ${idx + 1}: ${of.contexto}`);
    of.precos.forEach(p => linhas.push(`  - Preço: ${p}`));
    linhas.push('');
  });
  return linhas;
}

async function coletarDados() {
  const url = 'https://www.latamairlines.com/br/pt';

  const browser = await puppeteer.launch({
  headless: true,
  executablePath: puppeteer.executablePath(), // usa o Chromium baixado no postinstall
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--lang=pt-BR'
  ],
  defaultViewport: { width: 1366, height: 900 }
});


  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await aceitaCookiesSeAparecer(page);
    await new Promise(r => setTimeout(r, 2000));

    const linhas = await extraiPrecosVisiveis(page);

    if (!linhas.length) {
      linhas.push('Nenhum preço encontrado automaticamente na página inicial. Tente rodar com headless: false e ajustar seletores/regex.');
    }

    const header = [
      `Coleta LATAM - ${new Date().toLocaleString('pt-BR')}`,
      `URL: ${url}`,
      ''.padEnd(60, '=')
    ];
    dadosExtraidos = header.concat(linhas).join('\n');

    console.log('Dados extraídos com sucesso!');
  } catch (err) {
    dadosExtraidos = `Erro na coleta: ${err.message}`;
    console.error(dadosExtraidos);
  } finally {
    await browser.close();
  }
}

// Executa a coleta ao iniciar
coletarDados();

// Interface HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Preços LATAM</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; }
        h1 { color: #d62828; }
        pre { background: #fff; padding: 15px; border: 1px solid #ccc; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>Preços extraídos da LATAM</h1>
      <pre id="dados">Carregando dados...</pre>
      <script>
        fetch('/dados')
          .then(res => res.text())
          .then(texto => {
            document.getElementById('dados').textContent = texto;
          })
          .catch(err => {
            document.getElementById('dados').textContent = 'Erro ao carregar os dados.';
            console.error(err);
          });
      </script>
    </body>
    </html>
  `);
});

// Rota para exibir os dados extraídos
app.get('/dados', (req, res) => {
  res.type('text/plain').send(dadosExtraidos);
});

// Rota opcional para favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Interface disponível em http://localhost:${PORT}`);
});

