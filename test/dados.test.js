"use strict";

const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { describe, test } = require("node:test");

const produtos = require("../data/produtos.json");

const CATEGORIAS = ["teclados", "mouses", "headsets", "mousepads"];

describe("catálogo (data/produtos.json)", () => {
  test("ids são únicos", () => {
    assert.equal(new Set(produtos.map(p => p.id)).size, produtos.length);
  });

  test("ids são inteiros de até 4 dígitos (formato aceito pela rota)", () => {
    for (const { id } of produtos) {
      assert.ok(Number.isInteger(id) && id >= 1 && id <= 9999, `id ${id}`);
    }
  });

  test("cada categoria existente tem quatro produtos", () => {
    for (const categoria of CATEGORIAS) {
      assert.equal(produtos.filter(p => p.categoria === categoria).length, 4, categoria);
    }
    assert.ok(produtos.every(p => CATEGORIAS.includes(p.categoria)));
  });

  test("campos obrigatórios estão preenchidos", () => {
    for (const p of produtos) {
      assert.ok(typeof p.nome === "string" && p.nome.trim(), `nome do id ${p.id}`);
      assert.ok(typeof p.descricao === "string" && p.descricao.trim(), `descrição do id ${p.id}`);
    }
  });

  test("preços são positivos e com no máximo 2 casas decimais", () => {
    for (const { id, preco } of produtos) {
      assert.ok(typeof preco === "number" && preco > 0, `preço do id ${id}`);
      assert.equal(Math.round(preco * 100) / 100, preco, `casas decimais do id ${id}`);
    }
  });

  test("preço anterior, quando existe, é maior que o preço atual", () => {
    for (const { id, preco, precoAnterior } of produtos) {
      if (precoAnterior != null) assert.ok(precoAnterior > preco, `id ${id}`);
    }
  });

  test("toda imagem referenciada existe em public/assets", () => {
    for (const { id, imagem } of produtos) {
      assert.ok(existsSync(path.join(__dirname, "..", "public", "assets", imagem)), `id ${id}: ${imagem}`);
    }
  });

  test("nenhum nome ou descrição contém HTML", () => {
    for (const p of produtos) {
      assert.doesNotMatch(`${p.nome} ${p.descricao}`, /[<>]/, `id ${p.id}`);
    }
  });
});
