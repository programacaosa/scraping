// index.js
// Guia simples para extrair preços visíveis na página inicial da LATAM e salvar em TXT.
// Observação: o site muda com frequência; ajuste seletores/regex se necessário.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
require('dotenv').config();

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function aceitaCookiesSeAparecer(page) {
  try {
    // Tenta encontrar botões comuns de consentimento
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
  } catch {
    // Ignora se não achar
  }
}

async function extraiPrecosVisiveis(page) {
  // Regex para preços no padrão brasileiro e BRL
  const priceRegex = /(\bR\$|\bBRL)\s?\d{1,3}(\.\d{3})*,\d{2}/g;

  // Busca em blocos grandes de conteúdo para achar preços “com contexto”
  const offers = await page.evaluate((pricePattern) => {
    const data = [];
    const blocks = Array.from(document.querySelectorAll('section, article, li, div'));
    for (const node of blocks) {
      const text = (node.innerText || '').replace(/\s+\n/g, '\n').trim();
      if (!text) continue;
      const matches = text.match(new RegExp(pricePattern));
      if (matches && matches.length) {
        // Pega algumas primeiras linhas como "título/contexto"
        const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
        const header = lines.slice(0, 3).join(' | ').slice(0, 200);
        data.push({
          contexto: header,
          precos: Array.from(new Set(matches)) // remove duplicados dentro do bloco
        });
      }
    }
    // Remove itens redundantes por contexto
    const seen = new Set();
    return data.filter(item => {
      const key = item.contexto + '|' + item.precos.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, priceRegex.source);

  // Achata em linhas legíveis
  const linhas = [];
  offers.forEach((of, idx) => {
    linhas.push(`Oferta ${idx + 1}: ${of.contexto}`);
    of.precos.forEach(p => linhas.push(`  - Preço: ${p}`));
    linhas.push('');
  });
  return linhas;
}

async function main() {
  const url = 'https://www.latamairlines.com/br/pt';
  const outDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `latam-precos-${timestamp()}.txt`);

  const browser = await puppeteer.launch({
    headless: true,               // coloque false para ver o navegador funcionando
    args: ['--lang=pt-BR'],
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

    // Pequena espera extra para conteúdos dinâmicos
    await new Promise(r => setTimeout(r, 2000));


    const linhas = await extraiPrecosVisiveis(page);

    if (!linhas.length) {
      linhas.push('Nenhum preço encontrado automaticamente na página inicial. Tente rodar com headless: false e ajustar seletores/regex.');
    }

    // Salva no TXT
    const header = [
      `Coleta LATAM - ${new Date().toLocaleString('pt-BR')}`,
      `URL: ${url}`,
      ''.padEnd(60, '=')
    ];
    const conteudo = header.concat(linhas).join('\n');
    fs.writeFileSync(outFile, conteudo, 'utf8');

    console.log(`Arquivo salvo: ${outFile}`);
  } catch (err) {
    console.error('Erro na coleta:', err.message);
  } finally {
    await browser.close();
  }
}

main();
