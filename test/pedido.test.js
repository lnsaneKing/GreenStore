"use strict";

const assert = require("node:assert/strict");
const { describe, test, before } = require("node:test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { criarCatalogo } = require("../src/catalogo");
const { ErroDeValidacao, simularPedido } = require("../src/pedido");

const catalogo = criarCatalogo([
  { id: 1, categoria: "teclados", preco: 249.9 },
  { id: 2, categoria: "mouses", preco: 129.9 }
]);

let regras;

before(async () => {
  regras = await import(pathToFileURL(path.join(__dirname, "..", "public", "regras.mjs")).href);
});

const pedidoValido = () => ({
  itens: [{ id: 1, quantidade: 1 }],
  pagamento: "cartao"
});

const simular = corpo => simularPedido(corpo, catalogo, regras);

function recusa(corpo, mensagem) {
  assert.throws(
    () => simular(corpo),
    erro => erro instanceof ErroDeValidacao && erro.message === mensagem
  );
}

describe("pedido válido", () => {
  test("devolve os totais em centavos", () => {
    assert.deepEqual(simular(pedidoValido()), {
      simulacao: true,
      subtotalCentavos: 24990,
      descontoCentavos: 0,
      subtotalComDescontoCentavos: 24990,
      freteCentavos: null,
      descontoPagamentoCentavos: 0,
      totalCentavos: 24990
    });
  });

  test("aceita cupom em minúsculas e com espaços", () => {
    const resultado = simular({ ...pedidoValido(), cupom: "  green10 " });
    assert.equal(resultado.descontoCentavos, 2499);
  });

  test("ignora preço enviado pelo cliente e campos desconhecidos", () => {
    const resultado = simular({
      itens: [{ id: 1, quantidade: 1, preco: 0.01, desconto: 100 }],
      pagamento: "cartao",
      totalCentavos: 1,
      admin: true
    });

    assert.equal(resultado.subtotalCentavos, 24990);
    assert.equal(resultado.totalCentavos, 24990);
  });

  test("a quantidade máxima por produto é aceita", () => {
    const resultado = simular({ itens: [{ id: 2, quantidade: 99 }], pagamento: "cartao" });
    assert.equal(resultado.subtotalCentavos, 12990 * 99);
  });
});

describe("carrinho inválido", () => {
  for (const [descricao, corpo] of [
    ["sem corpo", undefined],
    ["corpo nulo", null],
    ["corpo que não é objeto", "texto"],
    ["itens ausentes", { pagamento: "pix" }],
    ["itens que não é lista", { itens: { id: 1 }, pagamento: "pix" }],
    ["lista vazia", { itens: [], pagamento: "pix" }],
    ["lista maior que o catálogo", { itens: [1, 2, 3].map(id => ({ id, quantidade: 1 })), pagamento: "pix" }]
  ]) {
    test(descricao, () => recusa(corpo, "Carrinho inválido."));
  }
});

describe("item inválido", () => {
  for (const [descricao, item] of [
    ["item nulo", null],
    ["item que não é objeto", 7],
    ["id inexistente", { id: 999, quantidade: 1 }],
    ["id decimal", { id: 1.5, quantidade: 1 }],
    ["id em texto", { id: "1", quantidade: 1 }],
    ["id ausente", { quantidade: 1 }],
    ["quantidade zero", { id: 1, quantidade: 0 }],
    ["quantidade negativa", { id: 1, quantidade: -1 }],
    ["quantidade acima do limite", { id: 1, quantidade: 100 }],
    ["quantidade decimal", { id: 1, quantidade: 1.5 }],
    ["quantidade em texto", { id: 1, quantidade: "2" }],
    ["quantidade NaN", { id: 1, quantidade: Number.NaN }],
    ["quantidade Infinity", { id: 1, quantidade: Infinity }]
  ]) {
    test(descricao, () => recusa({ itens: [item], pagamento: "pix" }, "Item inválido."));
  }

  test("produto repetido", () => {
    recusa({
      itens: [{ id: 1, quantidade: 1 }, { id: 1, quantidade: 1 }],
      pagamento: "pix"
    }, "Item inválido.");
  });
});

describe("cupom inválido", () => {
  for (const [descricao, cupom] of [
    ["inexistente", "NAOEXISTE"],
    ["número", 10],
    ["lista", ["GREEN10"]],
    ["objeto", { codigo: "GREEN10" }],
    ["longo demais", "A".repeat(21)],
    ["propriedade herdada de Object", "constructor"]
  ]) {
    test(descricao, () => recusa({ ...pedidoValido(), cupom }, "Cupom inválido."));
  }
});

describe("CEP inválido", () => {
  for (const [descricao, cep] of [
    ["7 dígitos", "3010000"],
    ["9 dígitos", "301000000"],
    ["com hífen", "30100-000"],
    ["com letras", "3010000a"],
    ["número", 30100000],
    ["com espaço", "30100000 "]
  ]) {
    test(descricao, () => recusa({ ...pedidoValido(), cep }, "CEP inválido."));
  }
});

describe("forma de pagamento inválida", () => {
  for (const [descricao, pagamento] of [
    ["ausente", undefined],
    ["boleto", "boleto"],
    ["maiúsculas", "PIX"],
    ["número", 1],
    ["lista", ["pix"]]
  ]) {
    test(descricao, () => recusa({ itens: [{ id: 1, quantidade: 1 }], pagamento }, "Forma de pagamento inválida."));
  }
});

describe("segurança dos dados de entrada", () => {
  test("__proto__ no corpo não contamina Object nem altera o cálculo", () => {
    const corpo = JSON.parse(
      '{"itens":[{"id":1,"quantidade":1}],"pagamento":"cartao","__proto__":{"admin":true}}'
    );

    assert.equal(simular(corpo).totalCentavos, 24990);
    assert.equal({}.admin, undefined);
  });
});
