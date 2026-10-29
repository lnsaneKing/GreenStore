"use strict";

const assert = require("node:assert/strict");
const { after, before, describe, test } = require("node:test");

const { iniciar, postar } = require("./auxiliar");

let loja;
let simular;

before(async () => {
  loja = await iniciar();
  simular = (corpo, cabecalhos) => postar(`${loja.url}/api/pedidos/simular`, corpo, cabecalhos);
});

after(() => loja.fechar());

const pedido = (extra = {}) => ({
  itens: [{ id: 1, quantidade: 1 }],
  pagamento: "cartao",
  ...extra
});

describe("GET /api/produtos", () => {
  test("lista os 16 produtos com cache de 5 minutos", async () => {
    const res = await fetch(`${loja.url}/api/produtos`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /application\/json/);
    assert.equal(res.headers.get("cache-control"), "public, max-age=300");
    assert.equal((await res.json()).length, 16);
  });

  test("filtra por categoria", async () => {
    const produtos = await (await fetch(`${loja.url}/api/produtos?categoria=mouses`)).json();

    assert.equal(produtos.length, 4);
    assert.ok(produtos.every(produto => produto.categoria === "mouses"));
  });

  test("ignora parâmetros desconhecidos", async () => {
    const produtos = await (await fetch(`${loja.url}/api/produtos?pagina=2&categoria[]=mouses`)).json();
    assert.equal(produtos.length, 16);
  });

  for (const consulta of ["categoria=xyz", "categoria=", "categoria=a&categoria=b", "categoria=__proto__"]) {
    test(`recusa ?${consulta}`, async () => {
      const res = await fetch(`${loja.url}/api/produtos?${consulta}`);

      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { erro: "Categoria inválida." });
    });
  }
});

describe("GET /api/produtos/:id", () => {
  test("devolve o produto", async () => {
    const res = await fetch(`${loja.url}/api/produtos/5`);
    const produto = await res.json();

    assert.equal(res.status, 200);
    assert.equal(produto.id, 5);
  });

  test("id que não existe devolve 404", async () => {
    const res = await fetch(`${loja.url}/api/produtos/9999`);
    assert.equal(res.status, 404);
  });

  for (const id of ["abc", "99999", "-1", "1.5", "1e2", "%20"]) {
    test(`id mal formado "${id}" devolve 400`, async () => {
      const res = await fetch(`${loja.url}/api/produtos/${id}`);
      assert.equal(res.status, 400);
    });
  }
});

describe("POST /api/pedidos/simular", () => {
  test("calcula o pedido e não permite cache", async () => {
    const res = await simular(pedido({ cep: "30100000" }));
    const dados = await res.json();

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.deepEqual(dados, {
      simulacao: true,
      subtotalCentavos: 24990,
      descontoCentavos: 0,
      subtotalComDescontoCentavos: 24990,
      freteCentavos: 1740,
      descontoPagamentoCentavos: 0,
      totalCentavos: 26730
    });
  });

  test("PIX com cupom", async () => {
    const dados = await (await simular(pedido({ pagamento: "pix", cupom: "GREEN10", cep: "30100000" }))).json();
    assert.equal(dados.totalCentavos, 23106);
  });

  test("a resposta tem exatamente os campos que o navegador compara", async () => {
    const { calcularTotais } = await import("../public/regras.mjs");
    const dados = await (await simular(pedido())).json();
    const { simulacao, ...totais } = dados;

    const esperado = calcularTotais(
      { itens: [{ id: 1, quantidade: 1 }], pagamento: "cartao" },
      new Map([[1, { preco: 249.9 }]])
    );

    assert.equal(simulacao, true);
    assert.deepEqual(Object.keys(totais), Object.keys(esperado));
  });

  for (const [descricao, corpo, mensagem] of [
    ["carrinho vazio", pedido({ itens: [] }), "Carrinho inválido."],
    ["produto inexistente", pedido({ itens: [{ id: 999, quantidade: 1 }] }), "Item inválido."],
    ["cupom inexistente", pedido({ cupom: "NAOEXISTE" }), "Cupom inválido."],
    ["CEP curto", pedido({ cep: "123" }), "CEP inválido."],
    ["pagamento inexistente", pedido({ pagamento: "boleto" }), "Forma de pagamento inválida."]
  ]) {
    test(`recusa ${descricao}`, async () => {
      const res = await simular(corpo);

      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { erro: mensagem });
    });
  }

  test("JSON malformado devolve 400, não 500", async () => {
    const res = await simular('{"itens":');

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { erro: "JSON inválido." });
  });

  test("corpo acima de 4 KB devolve 413", async () => {
    const res = await simular(pedido({ lixo: "a".repeat(5000) }));

    assert.equal(res.status, 413);
    assert.deepEqual(await res.json(), { erro: "Requisição grande demais." });
  });

  test("corpo que não é JSON é tratado como carrinho inválido", async () => {
    const res = await simular("itens=1", { "Content-Type": "text/plain" });

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { erro: "Carrinho inválido." });
  });

  test("resposta de erro não vaza detalhes internos", async () => {
    const res = await simular('{"itens":');
    const texto = await res.text();

    assert.doesNotMatch(texto, /SyntaxError|node_modules|at .*\(|\.js:\d+/);
  });

  test("GET na rota de simulação não existe", async () => {
    const res = await fetch(`${loja.url}/api/pedidos/simular`);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { erro: "Rota não encontrada." });
  });
});

describe("rotas inexistentes", () => {
  test("API devolve JSON", async () => {
    const res = await fetch(`${loja.url}/api/nada`);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { erro: "Rota não encontrada." });
  });

  test("fora da API devolve texto simples, sem página de erro do framework", async () => {
    const res = await fetch(`${loja.url}/nada`);
    const texto = await res.text();

    assert.equal(res.status, 404);
    assert.equal(texto, "Página não encontrada.");
    assert.doesNotMatch(texto, /Cannot GET|<html/i);
  });
});

describe("arquivos que não podem ser servidos", () => {
  for (const caminho of [
    "/server.js", "/package.json", "/package-lock.json", "/data/produtos.json",
    "/src/app.js", "/src/pedido.js", "/test/api.test.js", "/node_modules/express/package.json",
    "/.env", "/.git/config", "/..%2fserver.js", "/%2e%2e/server.js", "/public/../server.js"
  ]) {
    test(caminho, async () => {
      const res = await fetch(`${loja.url}${caminho}`);
      assert.equal(res.status, 404);
    });
  }
});

describe("site estático", () => {
  test("a página inicial sempre revalida", async () => {
    const res = await fetch(`${loja.url}/`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.equal(res.headers.get("cache-control"), "no-cache");
  });

  test("CSS, scripts e imagens ficam em cache por um dia", async () => {
    for (const arquivo of ["style.css", "script.js", "regras.mjs", "assets/teclado.webp"]) {
      const res = await fetch(`${loja.url}/${arquivo}`);

      assert.equal(res.status, 200, arquivo);
      assert.equal(res.headers.get("cache-control"), "public, max-age=86400", arquivo);
    }
  });

  test("regras.mjs é servido como JavaScript (o navegador exige para módulos)", async () => {
    const res = await fetch(`${loja.url}/regras.mjs`);
    assert.match(res.headers.get("content-type"), /javascript/);
  });

  test("respostas JSON são comprimidas", async () => {
    const res = await fetch(`${loja.url}/api/produtos`, { headers: { "Accept-Encoding": "gzip" } });
    assert.equal(res.headers.get("content-encoding"), "gzip");
  });
});

describe("cabeçalhos de segurança", () => {
  let cabecalhos;

  before(async () => {
    cabecalhos = (await fetch(`${loja.url}/`)).headers;
  });

  test("a política de conteúdo só permite recursos do próprio site", () => {
    const csp = cabecalhos.get("content-security-policy");

    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /connect-src 'self'(;|$)/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:\/\//);
  });

  test("impede detecção de tipo e uso em iframe de outros sites", () => {
    assert.equal(cabecalhos.get("x-content-type-options"), "nosniff");
    assert.equal(cabecalhos.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(cabecalhos.get("referrer-policy"), "no-referrer");
  });

  test("não revela o framework usado", () => {
    assert.equal(cabecalhos.get("x-powered-by"), null);
  });

  test("em desenvolvimento não força HTTPS nos recursos", () => {
    assert.doesNotMatch(cabecalhos.get("content-security-policy"), /upgrade-insecure-requests/);
  });
});

describe("limite de requisições", () => {
  test("a partir do limite a API devolve 429 em JSON", async () => {
    const limitada = await iniciar({ limiteRequisicoes: 3 });

    try {
      const respostas = [];

      for (let i = 0; i < 5; i++) {
        respostas.push(await fetch(`${limitada.url}/api/produtos`));
      }

      assert.deepEqual(respostas.map(res => res.status), [200, 200, 200, 429, 429]);
      assert.match((await respostas[3].json()).erro, /Muitas requisições/);

      // Arquivos do site não entram na contagem.
      assert.equal((await fetch(`${limitada.url}/`)).status, 200);
    } finally {
      await limitada.fechar();
    }
  });

  test("a resposta informa o limite para o cliente", async () => {
    const res = await fetch(`${loja.url}/api/produtos`);
    assert.ok(res.headers.get("ratelimit") || res.headers.get("ratelimit-policy"));
  });
});
