# Nutri Brasil Connect

preciso criar um sistema de consultar preciso para nutricar brasil com integração com api da vmpay abaixo as informações da api da vmpay para integração: Visão geral
Endpoints
Os endpoints são mapeados como segue:

https://vmpay.vertitecnologia.com.br/api/v1/caminho/para/resource
Autenticação
Cada operador receberá a sua API_KEY, que deverá ser passada na URL em TODAS as requisições feitas à API.

Exemplo:

https://vmpay.vertitecnologia.com.br/api/v1/caminho/para/api?access_token=837e068fbb4c1e1f
Operadores Filhos
Para utilizar essa funcionalidade, entre em contato com o suporte integracoes@vmtecnologia.io

Através da sua API_KEY é possível obter dados de Operadores Filhos informando o recurso desejado e o id do filho.

Exemplo:

/api/v1/recurso_desejado?access_token=837e068fbb4c1e1f@id_filho
Para consultar o id dos operadores filhos utilize a API de operadores.

Paginação
Serviços que retornam muitos registros podem usar paginação para evitar sobrecarga do servidor e demora no cliente. Quando habilitada os seguintes parâmetros estarão disponíveis:

page: a página a ser buscada pela consulta.

Caso não seja passado, é considerado 1.

per_page: o número de registros por página.

Caso não seja passado, é considerado 100.

Pode ser até 1000 no máximo.

Caso seja passado mais que 1000, é retornado erro com o código HTTP 400 (bad request).

Exemplo de requisição válida
Essa requisição lista toda as categorias de um determinado operador:

GET https://vmpay.vertitecnologia.com.br/api/v1/categories?access_token=213qweasdzxc
Códigos de retorno e seus significados
200: Requisição processada com sucesso / entidade salva com sucesso

201: Entidade criada com sucesso

204: Entidade excluída com sucesso

400: Algum parâmetro obrigatório faltando ou com formato errado

401: Tentativa de acesso a entidade não permitida

409: Conflito no request

422: Entidade não salva por conta de erros de validação

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nutri-brazil-gateway.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/05b06f81-a33c-46aa-8309-51add7e64edb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
