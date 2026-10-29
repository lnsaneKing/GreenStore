"use strict";

const { criarApp } = require("./src/app");

const PORTA = Number(process.env.PORT) || 3000;

// Por padrão só aceita conexões da própria máquina.
const HOST = process.env.HOST || "127.0.0.1";

criarApp().then(app => {
  const servidor = app.listen(PORTA, HOST, () => {
    console.log(`GreenStore em http://${HOST}:${PORTA}`);
  });

  for (const sinal of ["SIGINT", "SIGTERM"]) {
    process.on(sinal, () => servidor.close(() => process.exit(0)));
  }
});
