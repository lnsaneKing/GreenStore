import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, describe } from "node:test";

import * as regras from "../public/regras.mjs";

const {
  calcularDescontoCupom, calcularDescontoPagamento, calcularFrete,
  calcularSubtotal, calcularTotais, cupomValido, emCentavos, FRETE, valorNoPix
} = regras;

// Gerador pseudoaleatório com semente fixa: se um teste falhar, o mesmo pedido falha de novo.
function sorteador(semente) {
  let estado = semente;

  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const catalogo = new Map([
  [1, { preco: 249.9 }],
  [2, { preco: 189.9 }],
  [3, { preco: 500 }],
  [4, { preco: 31 }]
]);

describe("emCentavos", () => {
  test("converte reais em centavos inteiros", () => {
    assert.equal(emCentavos(249.9), 24990);
    assert.equal(emCentavos(0.01), 1);
  });

  test("corrige o erro de ponto flutuante (19.99 * 100 = 1998.9999999999998)", () => {
    assert.equal(emCentavos(19.99), 1999);
    assert.equal(emCentavos(0.29), 29);
  });
});

describe("calcularSubtotal", () => {
  test("soma preço vezes quantidade", () => {
    const itens = [{ id: 1, quantidade: 2 }, { id: 2, quantidade: 1 }];
    assert.equal(calcularSubtotal(itens, catalogo), 2 * 24990 + 18990);
  });
});

describe("cupons", () => {
  test("GREEN10 dá 10% de desconto", () => {
    assert.equal(calcularDescontoCupom("GREEN10", 24990), 2499);
  });

  test("GREEN10 arredonda meio centavo para cima", () => {
    assert.equal(calcularDescontoCupom("GREEN10", 25), 3);
    assert.equal(calcularDescontoCupom("GREEN10", 24), 2);
  });

  test("BEMVINDO dá R$ 20 de desconto", () => {
    assert.equal(calcularDescontoCupom("BEMVINDO", 24990), 2000);
  });

  test("BEMVINDO nunca passa do subtotal", () => {
    assert.equal(calcularDescontoCupom("BEMVINDO", 1500), 1500);
  });

  test("cupom vazio ou desconhecido não dá desconto", () => {
    assert.equal(calcularDescontoCupom("", 24990), 0);
    assert.equal(calcularDescontoCupom("NAOEXISTE", 24990), 0);
  });

  test("não confunde cupom com propriedades herdadas de Object", () => {
    for (const nome of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      assert.equal(cupomValido(nome), false, nome);
      assert.equal(calcularDescontoCupom(nome, 24990), 0, nome);
    }
  });

  test("o código do cupom diferencia maiúsculas de minúsculas", () => {
    assert.equal(cupomValido("green10"), false);
    assert.equal(cupomValido("GREEN10"), true);
  });
});

describe("frete", () => {
  test("sem CEP não há frete", () => {
    assert.equal(calcularFrete("", 10000), null);
  });

  test("sem produtos não há frete", () => {
    assert.equal(calcularFrete("30100000", 0), null);
  });

  test("é grátis a partir de R$ 299,00", () => {
    assert.equal(calcularFrete("30100000", FRETE.gratisAPartirDe), 0);
    assert.equal(calcularFrete("30100000", FRETE.gratisAPartirDe + 1), 0);
  });

  test("um centavo abaixo do limite ainda cobra frete", () => {
    assert.equal(calcularFrete("30100000", FRETE.gratisAPartirDe - 1), 1290 + 3 * 150);
  });

  test("o primeiro dígito do CEP define a região", () => {
    for (let digito = 0; digito <= 9; digito++) {
      const cep = `${digito}0000000`;
      assert.equal(calcularFrete(cep, 10000), FRETE.base + digito * FRETE.porRegiao);
    }
  });
});

describe("desconto por forma de pagamento", () => {
  test("PIX dá 5%, arredondando meio centavo para cima", () => {
    assert.equal(calcularDescontoPagamento("pix", 24990), 1250);
    assert.equal(calcularDescontoPagamento("pix", 10000), 500);
  });

  test("cartão não dá desconto", () => {
    assert.equal(calcularDescontoPagamento("cartao", 24990), 0);
  });

  test("valorNoPix é o valor menos o desconto", () => {
    assert.equal(valorNoPix(24990), 24990 - 1250);
  });
});

describe("calcularTotais", () => {
  const um = [{ id: 1, quantidade: 1 }];

  test("cartão com frete", () => {
    const t = calcularTotais({ itens: um, cep: "30100000", pagamento: "cartao" }, catalogo);
    assert.equal(t.freteCentavos, 1740);
    assert.equal(t.totalCentavos, 26730);
  });

  test("PIX com frete: o desconto não incide sobre o frete", () => {
    const t = calcularTotais({ itens: um, cep: "30100000", pagamento: "pix" }, catalogo);
    assert.equal(t.descontoPagamentoCentavos, 1250);
    assert.equal(t.totalCentavos, 25480);
  });

  test("PIX com cupom GREEN10", () => {
    const t = calcularTotais({ itens: um, cupom: "GREEN10", cep: "30100000", pagamento: "pix" }, catalogo);
    assert.equal(t.descontoCentavos, 2499);
    assert.equal(t.descontoPagamentoCentavos, 1125);
    assert.equal(t.totalCentavos, 23106);
  });

  test("frete grátis a partir de R$ 299 em produtos", () => {
    const t = calcularTotais({ itens: [{ id: 1, quantidade: 2 }], cep: "30100000", pagamento: "pix" }, catalogo);
    assert.equal(t.freteCentavos, 0);
    assert.equal(t.totalCentavos, 47481);
  });

  test("o cupom pode derrubar o pedido abaixo do limite e o frete volta a ser cobrado", () => {
    const itens = [{ id: 4, quantidade: 10 }]; // R$ 310,00

    const semCupom = calcularTotais({ itens, cep: "30100000", pagamento: "cartao" }, catalogo);
    const comCupom = calcularTotais({ itens, cupom: "GREEN10", cep: "30100000", pagamento: "cartao" }, catalogo);

    assert.equal(semCupom.freteCentavos, 0);
    assert.equal(comCupom.freteCentavos, 1740); // 279,00 depois do cupom
  });

  test("sem CEP o frete é null e não entra no total", () => {
    const t = calcularTotais({ itens: um, pagamento: "cartao" }, catalogo);
    assert.equal(t.freteCentavos, null);
    assert.equal(t.totalCentavos, 24990);
  });

  test("propriedades valem para 5.000 pedidos aleatórios", () => {
    const cupons = ["", "GREEN10", "BEMVINDO"];
    const pagamentos = ["pix", "cartao"];
    const sorte = sorteador(2026);

    for (let i = 0; i < 5000; i++) {
      const itens = [1, 2, 3, 4]
        .filter(() => sorte() < 0.6)
        .map(id => ({ id, quantidade: 1 + Math.floor(sorte() * 99) }));

      if (itens.length === 0) continue;

      const entrada = {
        itens,
        cupom: cupons[i % 3],
        cep: i % 4 === 0 ? "" : `${i % 10}0100000`,
        pagamento: pagamentos[i % 2]
      };

      const t = calcularTotais(entrada, catalogo);

      for (const [chave, valor] of Object.entries(t)) {
        if (valor !== null) assert.ok(Number.isInteger(valor) && valor >= 0, `${chave}: ${valor}`);
      }

      assert.ok(t.descontoCentavos <= t.subtotalCentavos);
      assert.equal(
        t.totalCentavos,
        t.subtotalCentavos - t.descontoCentavos - t.descontoPagamentoCentavos + (t.freteCentavos ?? 0)
      );

      if (t.freteCentavos !== null && t.subtotalComDescontoCentavos >= FRETE.gratisAPartirDe) {
        assert.equal(t.freteCentavos, 0);
      }
    }
  });
});

describe("contrato com o navegador", () => {
  test("script.js só importa nomes que regras.mjs realmente exporta", () => {
    const script = readFileSync(new URL("../public/script.js", import.meta.url), "utf8");
    const importacao = script.match(/import\s*\{([^}]+)\}\s*from\s*"\.\/regras\.mjs"/);

    assert.ok(importacao, "script.js deve importar de ./regras.mjs");

    for (const nome of importacao[1].split(",").map(n => n.trim()).filter(Boolean)) {
      assert.ok(nome in regras, `regras.mjs não exporta "${nome}"`);
    }
  });

  test("script.js não repete regras de preço escritas à mão", () => {
    const script = readFileSync(new URL("../public/script.js", import.meta.url), "utf8");

    assert.doesNotMatch(script, /\*\s*0\.95/, "desconto do PIX fixo no código");
    assert.doesNotMatch(script, /29900|1290/, "regra de frete fixa no código");
    assert.doesNotMatch(script, /\balert\(/, "alert() no lugar de mensagem na página");
  });
});
