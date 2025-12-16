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

Se preferir, posso automatizar deploys via Git (GitHub/GitLab) e configurar deploys automáticos por PRs/branches.

