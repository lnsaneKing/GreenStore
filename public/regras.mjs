// Regras de preço da GreenStore, em centavos.
//
// Módulo sem dependências de navegador ou de Node: a loja usa estas funções
// para mostrar o resumo na tela e o servidor as usa para calcular o valor
// oficial do pedido. Assim existe uma única fonte para cupom, frete e PIX.

export const LIMITE_QUANTIDADE = 99;
export const DESCONTO_PIX_PERCENTUAL = 5;

export const FRETE = Object.freeze({
  gratisAPartirDe: 29900,
  base: 1290,
  porRegiao: 150
});

export const CUPONS = Object.freeze({
  GREEN10: Object.freeze({ tipo: "percentual", valor: 10 }),
  BEMVINDO: Object.freeze({ tipo: "fixo", valor: 2000 })
});

export const FORMAS_DE_PAGAMENTO = Object.freeze(["pix", "cartao"]);

export const emCentavos = preco => Math.round(preco * 100);

// Arredonda para o centavo mais próximo usando só inteiros (sem erro de ponto flutuante).
const percentual = (valor, pontos) => Math.floor((valor * pontos + 50) / 100);

export const cupomValido = codigo => Object.hasOwn(CUPONS, codigo);

export function calcularSubtotal(itens, produtosPorId) {
  let total = 0;

  for (const { id, quantidade } of itens) {
    total += emCentavos(produtosPorId.get(id).preco) * quantidade;
  }

  return total;
}

export function calcularDescontoCupom(codigo, subtotal) {
  if (!cupomValido(codigo)) return 0;

  const cupom = CUPONS[codigo];

  return cupom.tipo === "percentual"
    ? percentual(subtotal, cupom.valor)
    : Math.min(cupom.valor, subtotal);
}

// Sem CEP (ou sem produtos) não há frete a calcular: devolve null.
export function calcularFrete(cep, valorProdutos) {
  if (!cep || valorProdutos <= 0) return null;
  if (valorProdutos >= FRETE.gratisAPartirDe) return 0;

  return FRETE.base + Number(cep[0]) * FRETE.porRegiao;
}

// O desconto do PIX incide sobre os produtos já com cupom, nunca sobre o frete.
export function calcularDescontoPagamento(pagamento, valorProdutos) {
  return pagamento === "pix"
    ? percentual(valorProdutos, DESCONTO_PIX_PERCENTUAL)
    : 0;
}

export const valorNoPix = centavos =>
  centavos - calcularDescontoPagamento("pix", centavos);

export function calcularTotais({ itens, cupom = "", cep = "", pagamento }, produtosPorId) {
  const subtotalCentavos = calcularSubtotal(itens, produtosPorId);
  const descontoCentavos = calcularDescontoCupom(cupom, subtotalCentavos);
  const subtotalComDescontoCentavos = subtotalCentavos - descontoCentavos;
  const freteCentavos = calcularFrete(cep, subtotalComDescontoCentavos);
  const descontoPagamentoCentavos =
    calcularDescontoPagamento(pagamento, subtotalComDescontoCentavos);

  return {
    subtotalCentavos,
    descontoCentavos,
    subtotalComDescontoCentavos,
    freteCentavos,
    descontoPagamentoCentavos,
    totalCentavos:
      subtotalComDescontoCentavos - descontoPagamentoCentavos + (freteCentavos ?? 0)
  };
}
