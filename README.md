# Casal no Mundo

Link page estática com painel de edição e relatórios. Em produção, o conteúdo, o login administrativo e os eventos de analytics usam Supabase. A Vercel serve os arquivos estáticos e `/api/config`.

## Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, execute todo o arquivo [`supabase/schema.sql`](supabase/schema.sql) e depois [`supabase/storage.sql`](supabase/storage.sql) para ativar o envio de imagens.
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
5. Acesse `/admin` e entre com o usuário administrador.

O frontend usa somente a chave publicável. Para criar usuários pelo painel, configure `SUPABASE_SECRET_KEY` exclusivamente no servidor da Vercel, conforme a seção de usuários abaixo. Essa chave nunca é retornada por `/api/config` nem enviada ao navegador.

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

Abra `http://127.0.0.1:8000` e acesse o painel em `http://127.0.0.1:8000/admin`. Sem credenciais, a página continua funcionando e o painel oferece “Abrir painel em modo local” em localhost; o servidor grava conteúdo em `conteudo.json` e métricas em `analytics.json` (ignorado pelo Git).

## Relatórios e privacidade

Visitas, cliques e seções vistas são registrados sem IP ou identificador individual. O rodapé não oferece coleta de localização. O relatório de regiões preserva somente os dados históricos compartilhados com consentimento, sem solicitar novas localizações.

## Envio de imagens

No painel `/admin`, os campos de imagem do perfil, hospedagens, destinos, produtos e destaques permitem **Enviar imagem**, visualizar a prévia e **Remover**. O link de imagem continua disponível em **Usar um link de imagem**. São aceitos JPG, PNG, WebP e GIF de até 5 MB. Após enviar ou remover, clique em **Salvar alterações** para publicar.

Execute [`supabase/storage.sql`](supabase/storage.sql) uma vez no SQL Editor do projeto existente. Ele cria o bucket público `site-images`, limita formatos/tamanho e permite envio somente aos usuários de `site_admins`. O SQL é reaplicável. A chave publicável continua sendo suficiente no navegador; não adicione `service_role` ao frontend. Arquivos enviados têm nomes únicos e não substituem imagens publicadas. Remover no formulário retira a referência ao salvar, preservando arquivos que podem estar em uso em outro conteúdo.

Sem Supabase, no modo local, os arquivos são gravados em `uploads/`, ignorada pelo Git e pela Vercel. Essas imagens locais não são enviadas ao site de produção; para publicação use o upload conectado ao Supabase.

Validação do envio (sem instalar dependências):

```sh
node --test tests/image-upload.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py'
```

## Usuários e permissões

Os usuários que já constam em `site_admins` são os **acessos nativos**: mantêm acesso completo, incluindo importar/exportar JSON e gerenciar cadastros. Os novos usuários nunca são inseridos nessa tabela pelo painel.

Para ativar:

1. Execute [`supabase/access.sql`](supabase/access.sql) no SQL Editor depois de `schema.sql` e `storage.sql`. É uma migração reaplicável que preserva os acessos nativos e o conteúdo atual.
2. No Supabase, copie uma chave **Secret** do projeto (ou `service_role` legada). Na Vercel, crie `SUPABASE_SECRET_KEY` em **Settings → Environment Variables → Production** e marque como secreta. Não coloque essa chave no código, nos campos do painel, em variáveis `NEXT_PUBLIC_`/`VITE_` ou em `/api/config`.
3. Faça um novo deploy após configurar a variável. O endpoint Node `/api/users` só funciona na Vercel (ou em `vercel dev`); o servidor Python oferece a prévia do painel e edição local, sem provisionar contas.
4. Entre com um acesso nativo e abra **Usuários e permissões**. Preencha nome, e-mail e senha inicial (12–128 caracteres), escolha as seções e clique em **Criar cadastro**. Não há cadastro público nem envio de e-mail automático. A sessão do administrador é preservada.

Permissões disponíveis: Perfil, Hospedagens, Destinos, Produtos, Destaques, Redes e contato, Relatórios e Criar usuários. As seções de conteúdo permitem edição e upload de imagens na seção correspondente; Relatórios libera a visão geral e os relatórios, sem edição. Importar/exportar JSON e alterar ou desativar acessos existentes são exclusivos dos nativos. A permissão **Criar usuários** pode ser liberada por um nativo: ela permite cadastrar novas contas apenas com as seções que o criador já tem, sem conceder a própria permissão de criar usuários. Para suspender um cadastro, desmarque **Acesso ativo** e salve suas permissões. Cadastros existentes no Supabase sem acesso ao painel aparecem na lista e podem receber permissões por um nativo.

As regras são aplicadas no PostgreSQL: usuários limitados não podem escrever diretamente em `site_content`, modificar `site_members` ou promover-se a nativos. A função `save_site_sections` valida cada seção e sua versão antes de mesclar as alterações. A revogação bloqueia novas gravações, leituras de relatórios e uploads, mesmo se uma tela antiga continuar aberta. Imagens publicadas e conteúdo público do site continuam públicos.

Até a migração, acessos nativos continuam editando e salvando conteúdo. O cadastro e os acessos limitados só ficam ativos após a configuração. Se uma conta for criada no Auth mas houver falha ao gravar as permissões, ela fica sem acesso e pode ser liberada por um nativo na lista de usuários, sem excluir ou substituir a conta.

Validação de acesso:

```sh
node --test tests/permissions.test.cjs tests/users-api.test.cjs tests/image-upload.test.cjs
```

Para executar o teste de regras em PostgreSQL/WASM sem alterar as dependências do site, instale `@electric-sql/pglite` em um diretório temporário e execute `PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite node --test tests/access-db.test.cjs`. O teste reaplica as migrações e cobre edição por seção, bloqueio de promoção, relatórios, uploads, concorrência e revogação. Ele é ignorado quando `PGLITE_MODULE` não está definido.

### Delegar criação de usuários

Em instalações que já executaram a versão anterior de `access.sql`, execute somente [`supabase/access-users.sql`](supabase/access-users.sql) uma vez (ou reaplique `access.sql` atualizado). A migração libera a nova opção no banco sem concedê-la automaticamente a ninguém.

Com um acesso nativo, abra **Usuários e permissões**, marque **Criar usuários** no cadastro desejado e salve. Libere também as seções que esse cadastro poderá conceder às novas contas. O criador verá o formulário de cadastro com apenas essas seções. A API verifica seu acesso ativo e recusa concessões maiores, incluindo a tentativa de delegar **Criar usuários**. Consultar todos os usuários, alterar permissões existentes, desativar contas e importar/exportar JSON continuam exclusivos dos nativos.

## Painel no celular

Até 760 px, o painel usa um cabeçalho com o botão **Menu**, que abre a navegação lateral. O menu fecha ao escolher uma seção, tocar no fundo ou pressionar Escape; o foco fica dentro dele enquanto está aberto. Os itens continuam respeitando as permissões do usuário. A barra inferior mantém **Salvar alterações** e o estado de salvamento visíveis; importar/exportar JSON fica em **Mais ações**, somente para nativos. Contas sem edição de conteúdo não exibem essa barra.

Formulários usam uma coluna, campos com fonte de 16 px e controles maiores para toque. O layout considera as áreas de segurança do celular. A navegação desktop é preservada ao aumentar a largura.

Os testes do menu usam um DOM em memória e não substituem uma conferência visual em aparelho real. Para executá-los, instale `jsdom` em um diretório temporário e use `JSDOM_MODULE=/caminho/node_modules/jsdom node --test tests/panel-mobile.test.cjs`.
