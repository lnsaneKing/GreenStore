"use strict";

// Valida o corpo da requisição e calcula o pedido com as regras compartilhadas.

class ErroDeValidacao extends Error {}

const TAMANHO_MAXIMO_CUPOM = 20;

function texto(valor, mensagem) {
  if (typeof valor !== "string") throw new ErroDeValidacao(mensagem);
  return valor;
}

function validarItens(itens, regras, catalogo) {
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > catalogo.produtos.length) {
    throw new ErroDeValidacao("Carrinho inválido.");
  }

  const vistos = new Set();

  for (const item of itens) {
    const valido =
      item !== null &&
      typeof item === "object" &&
      Number.isSafeInteger(item.id) &&
      catalogo.porId.has(item.id) &&
      !vistos.has(item.id) &&
      Number.isSafeInteger(item.quantidade) &&
      item.quantidade >= 1 &&
      item.quantidade <= regras.LIMITE_QUANTIDADE;

    if (!valido) throw new ErroDeValidacao("Item inválido.");

    vistos.add(item.id);
  }

  return itens.map(({ id, quantidade }) => ({ id, quantidade }));
}

function validarCupom(valor, regras) {
  const cupom = texto(valor ?? "", "Cupom inválido.").trim().toUpperCase();

  if (cupom.length > TAMANHO_MAXIMO_CUPOM || (cupom !== "" && !regras.cupomValido(cupom))) {
    throw new ErroDeValidacao("Cupom inválido.");
  }

  return cupom;
}

function validarCep(valor) {
  const cep = texto(valor ?? "", "CEP inválido.");

  if (cep !== "" && !/^\d{8}$/.test(cep)) {
    throw new ErroDeValidacao("CEP inválido.");
  }

  return cep;
}

function validarPagamento(valor, regras) {
  if (!regras.FORMAS_DE_PAGAMENTO.includes(valor)) {
    throw new ErroDeValidacao("Forma de pagamento inválida.");
  }

  return valor;
}

function simularPedido(corpo, catalogo, regras) {
  const entrada = {
    itens: validarItens(corpo?.itens, regras, catalogo),
    cupom: validarCupom(corpo?.cupom, regras),
    cep: validarCep(corpo?.cep),
    pagamento: validarPagamento(corpo?.pagamento, regras)
  };

  return { simulacao: true, ...regras.calcularTotais(entrada, catalogo.porId) };
}

module.exports = { ErroDeValidacao, simularPedido };
