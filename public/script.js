/* =====================================
   GREENSTORE - JAVASCRIPT
   Catálogo (via API), pesquisa, favoritos,
   carrinho, cupom, frete e checkout simulado
   Sem frameworks ou dependências
===================================== */

import {
  DESCONTO_PIX_PERCENTUAL,
  LIMITE_QUANTIDADE,
  calcularTotais,
  cupomValido,
  emCentavos,
  valorNoPix
} from "./regras.mjs";

// Escapa texto vindo da API antes de inserir no HTML (evita XSS).
function esc(texto) {
  return String(texto).replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[caractere]));
}

const categorias = [
  { id: "teclados", nome: "Teclados" },
  { id: "mouses", nome: "Mouses" },
  { id: "headsets", nome: "Headsets" },
  { id: "mousepads", nome: "Mousepads" }
];

// Produtos vêm da API do servidor
async function carregarProdutos() {
  try {
    const resposta = await fetch("/api/produtos");

    if (!resposta.ok) throw new Error();

    return await resposta.json();
  } catch {
    document.getElementById("catalogo-lista").innerHTML = `
      <p class="no-results">
        Não foi possível carregar os produtos.
        Inicie o servidor com "npm start".
      </p>
    `;

    throw new Error("API indisponível");
  }
}

const produtos = await carregarProdutos();

// Recursos compartilhados

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const produtosPorId = new Map(
  produtos.map(produto => [produto.id, produto])
);

const categoriaPorId = new Map(
  categorias.map(categoria => [
    categoria.id,
    categoria.nome
  ])
);

// Elementos HTML

const catalogo = document.getElementById("catalogo-lista");
const busca = document.getElementById("search-input");
const filtro = document.getElementById("catalog-filter");
const ordem = document.getElementById("catalog-order");
const contador = document.getElementById("catalog-count");
const avisoVazio = document.getElementById("aviso-vazio");

const produtoDialog = document.getElementById("produto-dialog");
const produtoTitulo = document.getElementById("produto-titulo");
const produtoImagem = document.getElementById("produto-imagem");
const produtoCategoria = document.getElementById("produto-categoria");
const produtoPreco = document.getElementById("produto-preco");
const produtoPrecoAntigo = document.getElementById("produto-preco-antigo");
const produtoDescricao = document.getElementById("produto-descricao");
const produtoAdicionar = document.getElementById("produto-adicionar");

const carrinhoDialog = document.getElementById("carrinho-dialog");
const carrinhoItens = document.getElementById("carrinho-itens");
const carrinhoTotal = document.getElementById("carrinho-total");
const carrinhoContador = document.getElementById("cart-count");
const carrinhoStatus = document.getElementById("cart-status");

let produtoSelecionado = null;

// Favoritos (precisa existir antes de montar o catálogo)
const CHAVE_FAV = "greenstore-favoritos";
let soFavoritos = false;
let favoritos = new Set();

try {
  const salvos = JSON.parse(localStorage.getItem(CHAVE_FAV) || "[]");

  if (Array.isArray(salvos)) {
    favoritos = new Set(salvos.filter(id => produtosPorId.has(id)));
  }
} catch {
  // Sem favoritos salvos.
}

// =====================================
// TEMA CLARO E ESCURO
// =====================================

const raiz = document.documentElement;
const botaoTema = document.getElementById("alternar-tema");
const temaIcone = document.getElementById("tema-icone");
const temaTexto = document.getElementById("tema-texto");

let temaAtual = raiz.dataset.theme === "dark"
  ? "dark"
  : "light";

function aplicarTema(tema, salvar = false) {
  temaAtual = tema === "dark" ? "dark" : "light";

  const escuro = temaAtual === "dark";

  raiz.dataset.theme = temaAtual;

  temaTexto.textContent = escuro
    ? "Modo escuro"
    : "Modo claro";

  temaIcone.textContent = escuro ? "☾" : "☀";

  botaoTema.setAttribute(
    "aria-label",
    escuro ? "Ativar modo claro" : "Ativar modo escuro"
  );

  botaoTema.setAttribute("aria-pressed", String(escuro));

  const meta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (meta) {
    meta.content = escuro ? "#0C1220" : "#EEF2F9";
  }

  if (salvar) {
    try {
      localStorage.setItem("greenstore-tema", temaAtual);
    } catch {
      // O tema continua funcionando na sessão.
    }
  }
}

botaoTema.addEventListener("click", () => {
  aplicarTema(
    temaAtual === "dark" ? "light" : "dark",
    true
  );
});

aplicarTema(temaAtual);

// =====================================
// CATÁLOGO
// =====================================

function criarCard(produto) {
  const desconto = produto.precoAnterior
    ? Math.round((1 - produto.preco / produto.precoAnterior) * 100)
    : 0;

  const pix = valorNoPix(emCentavos(produto.preco)) / 100;
  const parcela = produto.preco / 10;

  return `
    <article class="product-tile" data-id="${produto.id}">
      <button
        class="product-open"
        type="button"
        data-product-id="${produto.id}"
        aria-label="Ver detalhes de ${esc(produto.nome)}"
      >
        <span class="product-photo">
          <img
            src="assets/${esc(produto.imagem)}"
            alt=""
            width="540"
            height="360"
            loading="lazy"
            decoding="async"
          >
          <span class="badges">
            ${desconto ? `<span class="badge">${desconto}% OFF</span>` : ""}
            <span class="badge stock">EM ESTOQUE</span>
          </span>
        </span>

        <span class="product-info">
          <span class="product-name">${esc(produto.nome)}</span>
          <span class="product-old">
            ${produto.precoAnterior ? "de " + moeda.format(produto.precoAnterior) + " por" : ""}
          </span>
          <span class="product-value">${moeda.format(produto.preco)}</span>
          <span class="product-pix">${moeda.format(pix)} no PIX (${DESCONTO_PIX_PERCENTUAL}% off)</span>
          <span class="product-parcel">
            10x de ${moeda.format(parcela)} sem juros
          </span>
        </span>
      </button>

      <button
        class="fav-btn"
        type="button"
        data-fav-id="${produto.id}"
        aria-pressed="${favoritos.has(produto.id)}"
        aria-label="Favoritar ${esc(produto.nome)}"
      >♥</button>
    </article>
  `;
}

// Monta o catálogo uma única vez.

function renderizarCatalogo() {
  catalogo.innerHTML = categorias.map(categoria => {
    const itens = produtos.filter(
      produto => produto.categoria === categoria.id
    );

    return `
      <section
        class="catalog-group"
        id="${categoria.id}"
        aria-labelledby="titulo-${categoria.id}"
      >
        <h3 id="titulo-${categoria.id}">
          ${categoria.nome}
        </h3>

        <div class="showcase-grid">
          ${itens.map(criarCard).join("")}
        </div>
      </section>
    `;
  }).join("");
}

renderizarCatalogo();

// Carrossel de ofertas (produtos em promoção primeiro)
const carrossel = document.getElementById("carrossel-lista");

carrossel.innerHTML = [...produtos]
  .sort((a, b) => (b.precoAnterior ? 1 : 0) - (a.precoAnterior ? 1 : 0))
  .slice(0, 8)
  .map(criarCard)
  .join("");

carrossel.addEventListener("click", evento => {
  const botao = evento.target.closest("button[data-product-id]");

  if (botao) abrirDetalhes(Number(botao.dataset.productId));
});

document.getElementById("car-prev").addEventListener("click", () =>
  carrossel.scrollBy({ left: -carrossel.clientWidth * 0.8, behavior: "smooth" })
);

document.getElementById("car-next").addEventListener("click", () =>
  carrossel.scrollBy({ left: carrossel.clientWidth * 0.8, behavior: "smooth" })
);

// =====================================
// PESQUISA, FILTROS E ORDENAÇÃO
// =====================================

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Referências preparadas uma única vez.

const grupos = categorias.map(categoria => {
  const secao = document.getElementById(categoria.id);
  const grade = secao.querySelector(".showcase-grid");

  const cards = [
    ...grade.querySelectorAll(".product-tile")
  ].map(elemento => {
    const produto = produtosPorId.get(
      Number(elemento.dataset.id)
    );

    return {
      elemento,
      produto,
      nome: normalizar(produto.nome)
    };
  });

  return {
    id: categoria.id,
    secao,
    grade,
    cards
  };
});

// Esconde e mostra os cards existentes.

function atualizarFiltros() {
  const termo = normalizar(busca.value.trim());
  const categoriaAtual = filtro.value;

  let encontrados = 0;

  for (const grupo of grupos) {
    const categoriaCorreta =
      categoriaAtual === "todos" ||
      categoriaAtual === grupo.id;

    let visiveis = 0;

    for (const card of grupo.cards) {
      const mostrar =
        categoriaCorreta &&
        card.nome.includes(termo) &&
        (!soFavoritos || favoritos.has(card.produto.id));

      card.elemento.hidden = !mostrar;

      if (mostrar) {
        visiveis++;
      }
    }

    grupo.secao.hidden = visiveis === 0;
    encontrados += visiveis;
  }

  contador.textContent =
    `${encontrados} ${encontrados === 1
      ? "produto encontrado"
      : "produtos encontrados"
    }`;

  avisoVazio.hidden = encontrados !== 0;
}

// Ordena sem criar novos cards.

function atualizarOrdenacao() {
  for (const grupo of grupos) {
    const itens = [...grupo.cards];

    if (ordem.value === "menor") {
      itens.sort(
        (a, b) => a.produto.preco - b.produto.preco
      );
    } else if (ordem.value === "maior") {
      itens.sort(
        (a, b) => b.produto.preco - a.produto.preco
      );
    } else if (ordem.value === "nome") {
      itens.sort((a, b) =>
        a.produto.nome.localeCompare(
          b.produto.nome,
          "pt-BR"
        )
      );
    }

    grupo.grade.replaceChildren(
      ...itens.map(item => item.elemento)
    );
  }

  atualizarFiltros();
}

busca.addEventListener("input", atualizarFiltros);
filtro.addEventListener("change", atualizarFiltros);
ordem.addEventListener("change", atualizarOrdenacao);

// Departamentos e faixas promocionais.

document.querySelectorAll(
  ".department-content a, .promo-grid a"
).forEach(link => {
  link.addEventListener("click", evento => {
    const destino = link.getAttribute("href").slice(1);

    if (
      destino !== "vitrines" &&
      !categoriaPorId.has(destino)
    ) {
      return;
    }

    evento.preventDefault();

    busca.value = "";
    filtro.value = destino === "vitrines"
      ? "todos"
      : destino;

    atualizarFiltros();

    document.getElementById("vitrines").scrollIntoView();
  });
});

atualizarFiltros();

// =====================================
// DETALHES DO PRODUTO
// =====================================

function abrirDetalhes(id) {
  const produto = produtosPorId.get(id);

  if (!produto) return;

  produtoSelecionado = id;

  produtoTitulo.textContent = produto.nome;
  produtoImagem.src = `assets/${produto.imagem}`;
  produtoImagem.alt =
    `Fotografia ilustrativa de ${produto.nome}`;

  produtoCategoria.textContent =
    categoriaPorId.get(produto.categoria);

  produtoPreco.textContent =
    moeda.format(produto.preco);

  document.getElementById("produto-pix").textContent =
    `${moeda.format(valorNoPix(emCentavos(produto.preco)) / 100)} no PIX • 10x de ${moeda.format(produto.preco / 10)} sem juros`;

  produtoPrecoAntigo.hidden = !produto.precoAnterior;

  produtoPrecoAntigo.textContent = produto.precoAnterior
    ? moeda.format(produto.precoAnterior)
    : "";

  produtoDescricao.textContent = produto.descricao;
  produtoAdicionar.textContent = "ADICIONAR AO CARRINHO";

  produtoDialog.showModal();
}

// Um único evento para todos os produtos.

catalogo.addEventListener("click", evento => {
  const botao = evento.target.closest(
    "button[data-product-id]"
  );

  if (!botao) return;

  abrirDetalhes(Number(botao.dataset.productId));
});

produtoDialog.addEventListener("close", () => {
  produtoSelecionado = null;
});

// =====================================
// CARRINHO DE COMPRAS
// =====================================

const CHAVE_CARRINHO = "greenstore-carrinho";

function carregarCarrinho() {
  try {
    const salvo = JSON.parse(
      localStorage.getItem(CHAVE_CARRINHO) || "{}"
    );

    if (
      !salvo ||
      typeof salvo !== "object" ||
      Array.isArray(salvo)
    ) {
      return {};
    }

    const itens = {};

    for (const [id, quantidade] of Object.entries(salvo)) {
      if (
        produtosPorId.has(Number(id)) &&
        Number.isInteger(quantidade) &&
        quantidade >= 1 &&
        quantidade <= LIMITE_QUANTIDADE
      ) {
        itens[id] = quantidade;
      }
    }

    return itens;
  } catch {
    return {};
  }
}

const carrinho = carregarCarrinho();

function salvarCarrinho() {
  try {
    localStorage.setItem(
      CHAVE_CARRINHO,
      JSON.stringify(carrinho)
    );

    return true;
  } catch {
    return false;
  }
}

function avisar(mensagem) {
  carrinhoStatus.textContent = mensagem;
}

function atualizarContador() {
  const quantidade = Object.values(carrinho).reduce(
    (total, valor) => total + valor,
    0
  );

  carrinhoContador.textContent = quantidade;
}

// Altera somente o item selecionado.

function alterarQuantidade(id, diferenca) {
  if (!produtosPorId.has(id)) return false;

  const atual = carrinho[id] || 0;

  const novaQuantidade = Math.max(
    0,
    Math.min(LIMITE_QUANTIDADE, atual + diferenca)
  );

  if (novaQuantidade === atual) return false;

  if (novaQuantidade === 0) {
    delete carrinho[id];
  } else {
    carrinho[id] = novaQuantidade;
  }

  const salvo = salvarCarrinho();

  atualizarContador();

  if (carrinhoDialog.open) {
    renderizarCarrinho();
  }

  if (!salvo) {
    avisar("Carrinho atualizado, mas não salvo no navegador.");
  }

  return true;
}

// Prepara a visualização do carrinho.

function renderizarCarrinho() {
  const itens = Object.entries(carrinho);

  if (itens.length === 0) {
    carrinhoItens.innerHTML = `
      <p class="cart-empty">
        Seu carrinho está vazio.
      </p>
    `;

    atualizarResumo();
    return;
  }

  carrinhoItens.innerHTML = itens.map(([id, quantidade]) => {
    const produto = produtosPorId.get(Number(id));

    const subtotalCentavos =
      Math.round(produto.preco * 100) * quantidade;

    return `
      <div class="cart-line">

        <div class="cart-line-info">
          <strong>${esc(produto.nome)}</strong>

          <span>
            ${moeda.format(produto.preco)} por unidade
          </span>

          <strong>
            ${moeda.format(subtotalCentavos / 100)}
          </strong>
        </div>

        <div class="cart-line-actions">

          <div class="quantity-controls">

            <button
              type="button"
              data-action="decrease"
              data-id="${id}"
              aria-label="Diminuir quantidade de ${esc(produto.nome)}"
            >−</button>

            <span>${quantidade}</span>

            <button
              type="button"
              data-action="increase"
              data-id="${id}"
              aria-label="Aumentar quantidade de ${esc(produto.nome)}"
              ${quantidade === LIMITE_QUANTIDADE ? "disabled" : ""}
            >+</button>

          </div>

          <button
            type="button"
            class="remove-item"
            data-action="remove"
            data-id="${id}"
          >
            Remover
          </button>

        </div>
      </div>
    `;
  }).join("");

  atualizarResumo();
}

// Adicionar somente pelos detalhes.

produtoAdicionar.addEventListener("click", () => {
  if (produtoSelecionado === null) return;

  const adicionado = alterarQuantidade(
    produtoSelecionado,
    1
  );

  produtoAdicionar.textContent = adicionado
    ? "ADICIONADO AO CARRINHO ✓"
    : `LIMITE DE ${LIMITE_QUANTIDADE} UNIDADES`;

  avisar(
    adicionado
      ? "Produto adicionado ao carrinho."
      : `Limite de ${LIMITE_QUANTIDADE} unidades atingido.`
  );
});

// Abrir carrinho.

document.getElementById("abrir-carrinho")
  .addEventListener("click", () => {
    renderizarCarrinho();
    carrinhoDialog.showModal();
  });

// Aumentar, diminuir ou remover.

carrinhoItens.addEventListener("click", evento => {
  const botao = evento.target.closest(
    "button[data-action]"
  );

  if (!botao) return;

  const id = Number(botao.dataset.id);
  const acao = botao.dataset.action;

  if (!produtosPorId.has(id)) return;

  if (acao === "remove") {
    delete carrinho[id];

    salvarCarrinho();
    atualizarContador();
    renderizarCarrinho();

    avisar("Produto removido do carrinho.");
  } else if (acao === "increase" || acao === "decrease") {
    alterarQuantidade(
      id,
      acao === "increase" ? 1 : -1
    );

    avisar("Quantidade atualizada.");
  }

  // Mantém a navegação por teclado após atualizar.
  const proximo = carrinhoItens.querySelector(
    `button[data-action="${acao}"][data-id="${id}"]`
  );

  if (proximo) {
    proximo.focus();
  } else {
    carrinhoDialog.querySelector(".dialog-close").focus();
  }
});

// Inicializa o contador do carrinho.

atualizarContador();

// =====================================
// FAVORITOS
// =====================================

const favContador = document.getElementById("fav-count");
const favLink = document.getElementById("abrir-favoritos");

function atualizarFavoritos() {
  favContador.textContent = favoritos.size;

  document.querySelectorAll("[data-fav-id]").forEach(botao => {
    botao.setAttribute(
      "aria-pressed",
      String(favoritos.has(Number(botao.dataset.favId)))
    );
  });

  try {
    localStorage.setItem(CHAVE_FAV, JSON.stringify([...favoritos]));
  } catch {
    // Os favoritos continuam funcionando na sessão.
  }
}

document.addEventListener("click", evento => {
  const botao = evento.target.closest("[data-fav-id]");

  if (!botao) return;

  const id = Number(botao.dataset.favId);

  if (favoritos.has(id)) {
    favoritos.delete(id);
    avisar("Produto removido dos favoritos.");
  } else {
    favoritos.add(id);
    avisar("Produto adicionado aos favoritos.");
  }

  atualizarFavoritos();

  if (soFavoritos) atualizarFiltros();
});

favLink.addEventListener("click", evento => {
  evento.preventDefault();

  soFavoritos = !soFavoritos;
  favLink.setAttribute("aria-pressed", String(soFavoritos));

  busca.value = "";
  filtro.value = "todos";

  atualizarFiltros();
  document.getElementById("vitrines").scrollIntoView();
});

atualizarFavoritos();

// =====================================
// RESUMO DO PEDIDO (CUPOM E FRETE)
// =====================================

const resSub = document.getElementById("resumo-subtotal");
const resDesc = document.getElementById("resumo-desconto");
const resFrete = document.getElementById("resumo-frete");
const resMsg = document.getElementById("resumo-msg");
const cupomInput = document.getElementById("cupom-input");
const cepInput = document.getElementById("cep-input");
const btnFinalizar = document.getElementById("finalizar");

// Cupom e CEP escolhidos pelo cliente (vazios enquanto não forem informados).
const selecao = { cupom: "", cep: "" };

const itensDoCarrinho = () =>
  Object.entries(carrinho).map(([id, quantidade]) => ({ id: Number(id), quantidade }));

// Valores do carrinho calculados com as mesmas regras do servidor (regras.mjs).
function calcularCarrinho(pagamento = "cartao") {
  return calcularTotais(
    { itens: itensDoCarrinho(), ...selecao, pagamento },
    produtosPorId
  );
}

const emReais = centavos => moeda.format(centavos / 100);

function atualizarResumo() {
  const r = calcularCarrinho();

  resSub.textContent = emReais(r.subtotalCentavos);

  resDesc.textContent = r.descontoCentavos
    ? `− ${emReais(r.descontoCentavos)}`
    : emReais(0);

  resFrete.textContent = r.freteCentavos === null
    ? "—"
    : r.freteCentavos === 0
      ? "Grátis"
      : emReais(r.freteCentavos);

  carrinhoTotal.textContent = emReais(r.totalCentavos);
  btnFinalizar.disabled = r.subtotalCentavos === 0;
}

document.getElementById("cupom-aplicar").addEventListener("click", () => {
  const codigo = cupomInput.value.trim().toUpperCase();

  if (!codigo) {
    selecao.cupom = "";
    resMsg.textContent = "Cupom removido.";
  } else if (cupomValido(codigo)) {
    selecao.cupom = codigo;
    resMsg.textContent = `Cupom ${codigo} aplicado.`;
  } else {
    selecao.cupom = "";
    resMsg.textContent = "Cupom inválido.";
  }

  atualizarResumo();
});

document.getElementById("cep-calcular").addEventListener("click", () => {
  const digitos = cepInput.value.replace(/\D/g, "");

  if (digitos.length !== 8) {
    selecao.cep = "";
    resMsg.textContent = "Digite um CEP com 8 números.";
  } else {
    selecao.cep = digitos;
    resMsg.textContent =
      `Entrega estimada em ${2 + Number(digitos[0])} dias úteis.`;
  }

  atualizarResumo();
});

// =====================================
// FINALIZAR COMPRA (SIMULAÇÃO)
// =====================================

const checkoutDialog = document.getElementById("checkout-dialog");
const checkoutForm = document.getElementById("checkout-form");
const checkoutOk = document.getElementById("checkout-ok");
const checkoutTotal = document.getElementById("checkout-total");
const checkoutErro = document.getElementById("checkout-erro");

const pagamentoEscolhido = () => checkoutForm.pagto.value;

function atualizarTotalCheckout() {
  const { totalCentavos } = calcularCarrinho(pagamentoEscolhido());

  checkoutTotal.textContent = pagamentoEscolhido() === "pix"
    ? `${emReais(totalCentavos)} no PIX`
    : `${emReais(totalCentavos)} em até 10x de ${emReais(totalCentavos / 10)}`;
}

// Pede ao servidor o valor oficial e confere com o que está na tela.
async function validarComServidor(pagamento) {
  const esperado = calcularCarrinho(pagamento);

  const resposta = await fetch("/api/pedidos/simular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itens: itensDoCarrinho(), ...selecao, pagamento })
  });

  if (!resposta.ok) throw new Error("Pedido rejeitado pelo servidor.");

  const oficial = await resposta.json();

  if (Object.keys(esperado).some(campo => oficial[campo] !== esperado[campo])) {
    throw new Error("Valores divergentes entre a tela e o servidor.");
  }

  return oficial;
}

function concluirPedido(oficial) {
  const nome = checkoutForm.nome.value.trim().split(" ")[0];
  const numero = "GS-" + Date.now().toString().slice(-6);

  for (const id of Object.keys(carrinho)) delete carrinho[id];

  salvarCarrinho();
  atualizarContador();

  selecao.cupom = "";
  selecao.cep = "";
  cupomInput.value = "";
  cepInput.value = "";
  resMsg.textContent = "";

  document.getElementById("checkout-pedido").textContent =
    `Obrigado, ${nome}! O pedido ${numero} (${emReais(oficial.totalCentavos)}) foi registrado. ` +
    "Esta é uma simulação: nada foi cobrado nem enviado.";

  checkoutForm.reset();
  checkoutForm.hidden = true;
  checkoutOk.hidden = false;
}

btnFinalizar.addEventListener("click", () => {
  carrinhoDialog.close();

  checkoutForm.hidden = false;
  checkoutOk.hidden = true;
  checkoutErro.hidden = true;

  atualizarTotalCheckout();
  checkoutDialog.showModal();
});

checkoutForm.addEventListener("change", atualizarTotalCheckout);

checkoutForm.addEventListener("submit", async evento => {
  evento.preventDefault();

  const botaoConfirmar = checkoutForm.querySelector('button[type="submit"]');

  checkoutErro.hidden = true;
  botaoConfirmar.disabled = true;

  let oficial;

  try {
    oficial = await validarComServidor(pagamentoEscolhido());
  } catch {
    checkoutErro.textContent = "Não foi possível validar o carrinho. Tente novamente.";
    checkoutErro.hidden = false;
    return;
  } finally {
    botaoConfirmar.disabled = false;
  }

  concluirPedido(oficial);
});