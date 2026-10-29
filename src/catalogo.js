"use strict";

// Índices montados uma única vez, na inicialização.
function criarCatalogo(produtos) {
  const porId = new Map(produtos.map(produto => [produto.id, produto]));
  const porCategoria = new Map();

  for (const produto of produtos) {
    const grupo = porCategoria.get(produto.categoria) ?? [];
    grupo.push(produto);
    porCategoria.set(produto.categoria, grupo);
  }

  return { produtos, porId, porCategoria };
}

module.exports = { criarCatalogo };
