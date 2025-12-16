<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/19d8nnt-_ufyNL1KfAMoJV4pL6A7qU_tC

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Integração com Supabase 🔧

Siga estes passos para criar o banco de dados usado pelo frontend e conectar localmente:

1. Crie um projeto no Supabase (https://app.supabase.com) e abra o **SQL Editor**.
2. Abra o arquivo `supabase_schema.sql` na raiz do repositório e cole todo o conteúdo no editor SQL do Supabase. Execute para criar as tabelas e seeds iniciais.
3. No projeto local, crie um arquivo `.env` ou `.env.local` na raiz do projeto com as variáveis abaixo (substitua pelos seus valores):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Inicie a aplicação (`npm run dev`). O cliente já utiliza as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `services/supabaseClient.ts`.

Observação: Não comite chaves sensíveis em repositórios públicos. A chave ANON é destinada ao cliente e tem permissões limitadas, mas mantenha boas práticas de segurança.

---

## Deploy no Vercel 🚀

Passos realizados para disponibilizar a aplicação em produção no Vercel:

1. Gere o build de produção localmente: `npm run build` (gera a pasta `dist`).
2. Use o Vercel CLI (ou `npx vercel`) para criar o projeto e subir o `dist` como deploy estático:
   - `npx vercel deploy dist --name gestao-tfd-pro --prod`
3. Adicione as variáveis de ambiente no painel do Vercel (ou via CLI):
   - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<anon-key>` (marcar como sensível)
4. Refaça deploy para que as variáveis entrem em vigor.

URL de produção (exemplo do deploy que fiz): https://gestao-tfd-pro.vercel.app

---

## Autenticação com Supabase Auth (implementado)

O sistema agora usa o Supabase Auth para autenticação (login por email/senha).

Para ativar o login com o usuário de teste, siga estes passos no painel do Supabase:

1. Acesse o seu projeto em https://app.supabase.com → Auth → Users.
2. Clique em **New user** e crie um usuário com:
   - Email: `admin@example.com`
   - Password: `admin123`
3. Após criar o usuário no Auth, abra o app em produção e faça login usando o email e a senha acima.

O fluxo implementado é:
- Login usa `supabase.auth.signInWithPassword({ email, password })`;
- Após autenticação, o app procura um perfil em `users` (pela coluna `auth_uid` ou `email`) e, se não existir, cria um perfil básico.

> Segurança: remova o seed de teste (`admin@example.com` / `admin123`) após criar suas contas reais. Para produção, recomendo usar Supabase Auth + políticas RLS mais estritas (já habilitei uma base, mas ajuste conforme seu fluxo).


---

## Ações automáticas que eu executei ✅

- Criei o repositório `souziatech/gestao-tfd-pro` no GitHub e enviei o código para a branch `main`.
- Conectei o repositório ao projeto Vercel para deploys automáticos a cada push na branch `main`.
- Adicionei um workflow de CI em `.github/workflows/ci.yml` (roda `npm ci` e `npm run build` em push/PR para `main`).
- Criei uma migration RLS em `supabase/migrations/*_enable_rls.sql` que habilita Row-Level Security em tabelas sensíveis e aplica políticas básicas (permissão de leitura para o cliente anônimo e restrição de escrita a usuários autenticados). Revise essas policies se você planeja usar autenticação do Supabase (recomendo usar Supabase Auth para maior segurança).

> Se quiser que o GitHub Actions também execute o deploy via Vercel (em vez de usar a integração Git do Vercel), eu posso criar um token de deploy `VERCEL_TOKEN` e adicionar como secret do repo, e então configurar o workflow para chamar o action oficial do Vercel.


