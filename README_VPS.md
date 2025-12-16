
# Guia de Implantação VPS - Gestão TFD Pro

## Pré-requisitos na VPS
1. **Docker** e **Docker Compose** instalados.
2. Acesso SSH à máquina.

## Passos para Instalação

1. **Transferir Arquivos**:
   Copie todos os arquivos deste projeto para uma pasta na sua VPS (ex: `/opt/tfd-pro`).

2. **Configurar Variáveis**:
   Edite o arquivo `docker-compose.yml` e altere a senha do banco de dados (`POSTGRES_PASSWORD`).

3. **Subir o Sistema**:
   Na pasta do projeto, execute:
   ```bash
   docker-compose up -d --build
   ```

4. **Acessar**:
   - O sistema estará disponível no IP da sua VPS (porta 80).
   - O gerenciador de banco (Adminer) estará na porta 8080.

## Estrutura do Banco de Dados
O arquivo `prisma/schema.prisma` contém a estrutura profissional do banco.
Para utilizá-lo futuramente com uma API Node.js:
1. Instale o Prisma: `npm install prisma --save-dev`
2. Gere as migrações: `npx prisma migrate dev`

## Nota Sobre Persistência
Atualmente, o frontend (`services/store.ts`) ainda salva os dados no navegador do usuário (LocalStorage). 
A infraestrutura acima prepara o terreno (Banco PostgreSQL rodando) para que você desenvolva ou conecte uma API Backend (Node.js/Express) que substituirá o `LocalStorage` pelo PostgreSQL definido no `schema.prisma`.
