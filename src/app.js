"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");

const compression = require("compression");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const { criarCatalogo } = require("./catalogo");
const { ErroDeValidacao, simularPedido } = require("./pedido");

const PASTA_PUBLICA = path.join(__dirname, "..", "public");
const UM_DIA = 24 * 60 * 60;
const CINCO_MINUTOS = 5 * 60;

function politicaDeConteudo(producao) {
  const diretivas = helmet.contentSecurityPolicy.getDefaultDirectives();

  for (const diretiva of ["script-src", "style-src", "img-src", "connect-src", "font-src"]) {
    diretivas[diretiva] = ["'self'"];
  }

  // Em http://localhost não existe HTTPS para onde redirecionar as requisições.
  if (!producao) diretivas["upgrade-insecure-requests"] = null;

  return diretivas;
}

function tratarErro(erro, req, res, next) {
  if (res.headersSent) return next(erro);

  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "JSON inválido." });
  }

  if (erro.type === "entity.too.large") {
    return res.status(413).json({ erro: "Requisição grande demais." });
  }

  console.error(erro);
  return res.status(500).json({ erro: "Erro interno do servidor." });
}

async function criarApp({
  produtos = require("../data/produtos.json"),
  limiteRequisicoes = 100,
  producao = process.env.NODE_ENV === "production"
} = {}) {
  // As regras de preço são um módulo ES compartilhado com o navegador.
  const regras = await import(pathToFileURL(path.join(PASTA_PUBLICA, "regras.mjs")).href);
  const catalogo = criarCatalogo(produtos);

  const app = express();

  app.set("trust proxy", false);

  app.use(helmet({ contentSecurityPolicy: { directives: politicaDeConteudo(producao) } }));
  app.use(compression());

  app.use(express.static(PASTA_PUBLICA, {
    dotfiles: "ignore",
    setHeaders(res, arquivo) {
      res.setHeader(
        "Cache-Control",
        arquivo.endsWith(".html") ? "no-cache" : `public, max-age=${UM_DIA}`
      );
    }
  }));

  app.use("/api", rateLimit({
    windowMs: 60 * 1000,
    limit: limiteRequisicoes,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { erro: "Muitas requisições. Tente novamente em instantes." }
  }));

  app.use("/api", express.json({ limit: "4kb" }));

  app.get("/api/produtos", (req, res) => {
    const { categoria } = req.query;

    if (categoria !== undefined && !catalogo.porCategoria.has(categoria)) {
      return res.status(400).json({ erro: "Categoria inválida." });
    }

    res.set("Cache-Control", `public, max-age=${CINCO_MINUTOS}`);
    res.json(categoria ? catalogo.porCategoria.get(categoria) : catalogo.produtos);
  });

  app.get("/api/produtos/:id", (req, res) => {
    if (!/^\d{1,4}$/.test(req.params.id)) {
      return res.status(400).json({ erro: "Identificador inválido." });
    }

    const produto = catalogo.porId.get(Number(req.params.id));

    if (!produto) {
      return res.status(404).json({ erro: "Produto não encontrado." });
    }

    res.set("Cache-Control", `public, max-age=${CINCO_MINUTOS}`);
    res.json(produto);
  });

  app.post("/api/pedidos/simular", (req, res) => {
    try {
      const resultado = simularPedido(req.body, catalogo, regras);

      res.set("Cache-Control", "no-store");
      res.json(resultado);
    } catch (erro) {
      if (!(erro instanceof ErroDeValidacao)) throw erro;

      res.status(400).json({ erro: erro.message });
    }
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ erro: "Rota não encontrada." });
  });

  app.use((req, res) => {
    res.status(404).type("text/plain").send("Página não encontrada.");
  });

  app.use(tratarErro);

  return app;
}

module.exports = { criarApp };
