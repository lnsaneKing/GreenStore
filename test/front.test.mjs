import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const ler = arquivo => readFileSync(new URL(`../public/${arquivo}`, import.meta.url), "utf8");

const html = ler("index.html");
const script = ler("script.js");

const idsDoHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

describe("ligação entre script.js e index.html", () => {
  test("todo id buscado com getElementById existe no HTML", () => {
    const buscados = [...script.matchAll(/getElementById\("([^"]+)"\)/g)].map(m => m[1]);

    assert.ok(buscados.length > 30, "esperava encontrar os getElementById do script");

    for (const id of buscados) {
      assert.ok(idsDoHtml.has(id), `id "${id}" não existe em index.html`);
    }
  });

  test("ids do HTML não se repetem", () => {
    const todos = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    const repetidos = todos.filter((id, i) => todos.indexOf(id) !== i);

    assert.deepEqual(repetidos, []);
  });

  test("o formulário de checkout tem os campos que o script lê", () => {
    for (const nome of ['name="nome"', 'name="pagto" value="pix"', 'name="pagto" value="cartao"']) {
      assert.ok(html.includes(nome), nome);
    }
  });

  test("script.js é carregado como módulo (necessário para importar regras.mjs)", () => {
    assert.match(html, /<script type="module" src="script\.js[^"]*"><\/script>/);
  });

  test("a página não usa scripts ou estilos escritos dentro do HTML (exigência da CSP)", () => {
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, "script inline");
    assert.doesNotMatch(html, /<style[\s>]/i, "bloco <style>");
    assert.doesNotMatch(html, /\sstyle="/i, "atributo style");
    assert.doesNotMatch(html, /\son[a-z]+="/i, "manipulador de evento inline");
  });

  test("toda imagem tem atributo alt", () => {
    const imagens = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);

    assert.ok(imagens.length > 0);
    assert.ok(imagens.every(tag => /\balt=/.test(tag)), "há <img> sem alt");
  });

  test("os arquivos locais referenciados existem", () => {
    for (const [, arquivo] of html.matchAll(/(?:src|href)="([a-z][\w.-]*\.(?:js|css))(?:\?[^"]*)?"/g)) {
      assert.doesNotThrow(() => ler(arquivo), arquivo);
    }
  });
});
