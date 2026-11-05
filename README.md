# Casal no Mundo

Link page estática com painel de edição e relatórios. Em produção, o conteúdo, o login administrativo e os eventos de analytics usam Supabase. A Vercel serve os arquivos estáticos e `/api/config`.

## Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, execute todo o arquivo [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Authentication → Providers / Settings**, desative cadastro público. Em **Authentication → Users**, crie um usuário para o administrador.
4. No SQL Editor, associe esse usuário ao painel, trocando o e-mail:

   ```sql
   insert into public.site_admins (user_id)
   select id from auth.users where email = 'SEU_EMAIL_DE_ADMIN'
   on conflict (user_id) do nothing;
   ```

5. Em **Project Settings → API**, copie o Project URL e a chave **Publishable** (ou `anon` em projetos antigos). Não use a chave `secret`/`service_role` no navegador.

O conteúdo inicial é carregado do arquivo local como fallback. Entre no painel e salve uma vez para gravá-lo na tabela `site_content`.

## Vercel

1. Envie o projeto para um repositório Git remoto e importe esse repositório na Vercel.
2. Em **Project Settings → Environment Variables**, adicione:
   - `SUPABASE_URL` — Project URL do Supabase.
   - `SUPABASE_PUBLISHABLE_KEY` — chave Publishable (ou `anon` antiga).
3. Faça um novo deploy. A Vercel publica a página estática e a função Node em `api/config.js`.
4. No Supabase, adicione o domínio Vercel em **Authentication → URL Configuration → Site URL / Redirect URLs**, por exemplo `https://seu-projeto.vercel.app/**`.
5. Acesse `/painel` e entre com o usuário administrador.

Não configure `SUPABASE_SECRET_KEY` nem `service_role` neste projeto: o frontend usa a chave publicável e as políticas RLS limitam as operações.

## Git

Crie um repositório vazio no GitHub/GitLab e conecte-o ao projeto:

```sh
git init -b main
git add .
git commit -m "Prepare site for Vercel and Supabase"
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

O `.gitignore` deixa de fora `.env.local`, `.vercel/` e `analytics.json`.

## Execução local

Copie `.env.example` para `.env.local`, preencha as duas variáveis com a URL e a chave publicável do Supabase e inicie:

```sh
python3 server.py
```

Abra `http://127.0.0.1:8000`. Sem credenciais, a página e o painel continuam funcionando em modo local; o servidor grava conteúdo em `conteudo.json` e métricas em `analytics.json` (ignorado pelo Git).

## Relatórios e privacidade

Visitas, cliques e seções vistas são registrados sem IP ou identificador individual. A localização aproximada só é enviada depois que a pessoa escolhe compartilhar e autoriza o navegador; as coordenadas são arredondadas antes do envio. O relatório de regiões mostra somente esse conjunto consentido.
