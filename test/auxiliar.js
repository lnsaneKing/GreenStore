"use strict";

const { criarApp } = require("../src/app");

// Sobe a aplicação numa porta livre e devolve a URL base e uma função para encerrar.
async function iniciar(opcoes = {}) {
  const app = await criarApp({ limiteRequisicoes: 10_000, ...opcoes });

  const servidor = await new Promise(resolver => {
    const aberto = app.listen(0, "127.0.0.1", () => resolver(aberto));
  });

  return {
    url: `http://127.0.0.1:${servidor.address().port}`,
    fechar: () => new Promise(resolver => {
      servidor.close(resolver);
      servidor.closeAllConnections();
    })
  };
}

function postar(url, corpo, cabecalhos = { "Content-Type": "application/json" }) {
  return fetch(url, {
    method: "POST",
    headers: cabecalhos,
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo)
  });
}

module.exports = { iniciar, postar };
