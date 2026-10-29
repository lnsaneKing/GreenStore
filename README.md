# GreenStore

**E-commerce fictício de periféricos desenvolvido como projeto de portfólio Full Stack.**

A GreenStore é uma aplicação demonstrativa para explorar o desenvolvimento de interfaces web, a integração entre Front-end e Back-end e a implementação de práticas de segurança, acessibilidade e **Green Coding**.

> **Projeto educacional:** produtos, preços, estoque, frete, pedidos e formas de pagamento são demonstrativos. A aplicação não realiza vendas, não processa pagamentos reais e não envia produtos.

## Funcionalidades

- Catálogo demonstrativo com **16 produtos**, distribuídos em teclados, mouses, headsets e mousepads.
- Busca de produtos, filtros por categoria e opções de ordenação.
- Visualização dos detalhes de cada produto.
- Lista de favoritos.
- Carrinho com adição, remoção, alteração de quantidades e atualização de valores.
- Persistência local do carrinho, favoritos e preferência de tema com `localStorage`.
- Cupons demonstrativos `GREEN10` (10% de desconto) e `BEMVINDO` (R$ 20 de desconto, limitado ao subtotal).
- Simulação de frete a partir de um CEP informado pelo usuário.
- Checkout fictício com opções de PIX e cartão, incluindo simulação de 5% de desconto no PIX.
- Validação dos itens e recálculo dos valores do pedido pela API antes da confirmação.
- Layout responsivo com modo claro e escuro.

## Tecnologias utilizadas

| Camada | Tecnologias |
|---|---|
| Front-end | HTML5, CSS3 e JavaScript |
| Back-end | Node.js e Express |
| Segurança HTTP | Helmet e express-rate-limit |
| Otimização HTTP | Compression e cache |
| Catálogo | JSON local |
| Persistência no navegador | localStorage |
| Imagens | WebP |

O Front-end foi desenvolvido sem frameworks de interface, com foco na simplicidade, no desempenho e na manutenção.

## Estrutura do projeto

```text
GreenStore/
├── data/
│   └── produtos.json
├── public/
│   ├── assets/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── tema-inicial.js
│   └── regras.mjs
├── src/
│   ├── app.js
│   ├── catalogo.js
│   └── pedido.js
├── test/
│   ├── auxiliar.js
│   ├── api.test.js
│   ├── dados.test.js
│   ├── front.test.mjs
│   ├── pedido.test.js
│   └── regras.test.mjs
├── .editorconfig
├── .gitattributes
├── .gitignore
├── server.js
├── package.json
├── package-lock.json
└── README.md
```

Apenas `public/` é servido como conteúdo estático. `src/`, `data/` e `test/` não ficam acessíveis por URL. O servidor inicia em `server.js`, enquanto `src/app.js` cria a aplicação Express sem iniciar uma porta automaticamente. O arquivo `public/regras.mjs` concentra os cálculos compartilhados entre cliente e servidor.

`node_modules/` é criada pelo npm e não deve ser versionada.

## Como executar localmente

### Pré-requisitos

- Node.js 18 ou superior.
- npm.
- Navegador atualizado.

### Instalação

**1. Clone o repositório ou baixe o código do projeto.**

**2. Abra o terminal na pasta raiz do projeto.**

**3. Instale as dependências:**

```bash
npm ci
```

**4. Inicie o servidor:**

```bash
npm start
```

**5. Acesse no navegador:**

```text
http://127.0.0.1:3000
```

O servidor utiliza `127.0.0.1` e a porta `3000` por padrão.

**Importante:** a loja deve ser aberta pelo servidor Node.js, e não diretamente pelo arquivo `index.html`, pois o catálogo depende da API.

## API REST

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos` | Lista todos os produtos |
| GET | `/api/produtos?categoria=mouses` | Filtra produtos por categoria |
| GET | `/api/produtos/:id` | Retorna um produto específico |
| POST | `/api/pedidos/simular` | Valida e calcula um pedido fictício |

### Exemplo de requisição

```json
{
  "itens": [
    {
      "id": 1,
      "quantidade": 1
    }
  ],
  "cupom": "GREEN10",
  "cep": "30110000",
  "pagamento": "pix"
}
```

O Back-end utiliza os preços definidos no catálogo local e não confia nos preços enviados pelo navegador.

Os cálculos monetários são realizados em centavos para reduzir problemas de arredondamento.

## Segurança

A GreenStore implementa medidas de segurança adequadas ao seu caráter demonstrativo:

- Cabeçalhos HTTP com Helmet.
- Content Security Policy (CSP).
- Limitação de requisições com express-rate-limit.
- Limite de tamanho para o JSON enviado à API.
- Validação de produtos, quantidades e cupons no servidor.
- Verificação de parâmetros de CEP e forma de pagamento.
- Rejeição de identificadores inválidos ou duplicados.
- Cálculo de valores no Back-end.
- Tratamento de erros sem exposição desnecessária de detalhes internos.

Essas medidas não representam uma certificação de segurança. O projeto permanece sujeito a revisões e melhorias.

A GreenStore não possui gateway de pagamento e não processa informações reais de cartão. A aplicação é executada localmente por padrão; uma implantação pública exigiria configuração de hospedagem e revisão adicional da infraestrutura.

## Green Coding

O projeto adota práticas de desenvolvimento voltadas à eficiência computacional e à redução de processamento e transferência de dados desnecessários.

### Práticas implementadas

- HTML, CSS e JavaScript nativos, evitando frameworks de interface desnecessários.
- Imagens WebP para reduzir o tamanho dos arquivos.
- Carregamento tardio de imagens quando aplicável.
- Compressão HTTP das respostas.
- Cache para recursos estáticos e consultas ao catálogo.
- Utilização de `Map` para consultas eficientes aos produtos.
- Persistência local de preferências e itens do carrinho.
- Estrutura focada na simplicidade e na manutenção do código.

### Transparência

As práticas acima são decisões de implementação.

Ainda não foram documentadas medições comparativas de consumo energético, emissões de carbono ou economia de recursos. Por isso, o projeto não apresenta alegações quantitativas de sustentabilidade.

## Testes e validações

O projeto possui testes automatizados nativos do Node.js, sem framework de testes adicional. Depois de `npm ci`, execute:

```bash
npm test
```

A suíte cobre cálculos e arredondamentos de cupons, PIX e frete, validação de pedidos, contratos dos arquivos do Front-end, catálogo, rotas HTTP, limites de tamanho, rate limiting e cabeçalhos de segurança. Em uma revisão local da integração, 139 testes foram executados sem falhas; isso não substitui testes completos de interação no navegador nem uma auditoria de segurança.

O comando `npm run audit:prod` consulta avisos de vulnerabilidades conhecidos nas dependências de produção e requer acesso ao registro npm.

**Verificações manuais recomendadas:** carregar o catálogo, buscar/filtrar produtos, alternar tema, favoritar, manipular o carrinho, aplicar cupons, informar CEP, escolher PIX/cartão e confirmar um pedido fictício. É importante conferir a versão em desktop e celular antes da divulgação.

## Limitações

A GreenStore é uma aplicação de portfólio e possui limitações intencionais:

- Não realiza pagamentos reais.
- Não possui integração com transportadoras.
- Não realiza entregas.
- Não possui banco de dados de pedidos.
- Não possui autenticação de clientes.
- Não possui controle real de estoque.
- Não representa uma operação comercial.
- Sem CEP informado, a simulação mantém o frete como **não calculado** e o total é apenas parcial, sem frete; não é uma cotação final de entrega.

## Próximas melhorias

- Conferir o checkout e a responsividade em navegadores reais.
- Expandir os testes de interface e cenários extremos.
- Revisão contínua de segurança.
- Medições de desempenho para documentar os resultados do Green Coding.
- Melhorias graduais na organização e manutenção do código.

## Objetivo do projeto

A GreenStore foi desenvolvida para demonstrar conhecimentos práticos de desenvolvimento Full Stack, incluindo:

- Construção de interfaces web.
- Manipulação do DOM e eventos.
- Consumo de APIs REST.
- Desenvolvimento de servidores com Node.js.
- Validação de dados.
- Lógica de carrinho e checkout.
- Organização de código.
- Práticas de segurança web.
- Otimização de desempenho e Green Coding.

O projeto faz parte de um portfólio voltado a oportunidades de estágio e desenvolvimento profissional na área de tecnologia.

## Autor

**Rafael Junio**

GitHub: [@lnsaneKing](https://github.com/lnsaneKing)

---

**GreenStore — Projeto demonstrativo de e-commerce Full Stack. Nenhuma compra ou cobrança real é realizada.**
