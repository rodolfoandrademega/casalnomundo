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

## Listas, lixeira e histórico nativo

Em instalações existentes, execute [`supabase/trash.sql`](supabase/trash.sql) no **SQL Editor** depois de `access.sql` e recarregue o painel. A migração preserva os conteúdos, atribui identificadores estáveis aos itens e cria as tabelas privadas `site_trash` e `site_activity`. Pode ser reaplicada. Ative essa estrutura antes de publicar a versão do painel com as novas listas.

Hospedagens, destinos, produtos, destaques e redes aparecem como listas com busca, ordenação por nome ou posição e ações **Adicionar**, **Editar** e **Excluir**. O editor abre em uma janela; **Salvar item** publica somente aquela coleção, preservando alterações ainda não salvas no perfil ou contato. Cancelar descarta apenas o rascunho do item. Nas listas, o envio de imagem é publicado com **Salvar item**; no perfil, use **Salvar alterações**.

Excluir remove o item publicado e grava sua cópia na lixeira na mesma transação. Apenas acessos nativos podem consultar ou recuperar itens. A proteção está nas permissões do banco, além do menu. As imagens e os vídeos permanecem no armazenamento para permitir recuperação. Não há exclusão definitiva pelo painel. A lixeira exige Supabase; o modo local não simula exclusões privadas em conteúdo público.

As lojas de produtos ficam em uma lista dentro do editor. A exclusão de uma loja só é confirmada ao salvar o produto. Se o produto original também tiver sido excluído, recupere primeiro o produto para depois recuperar uma loja arquivada separadamente. Alterações concorrentes exigem recarregar o painel. Antes de excluir ou recuperar, salve os rascunhos pendentes.

A área nativa **Acessos e atividades** registra entradas no painel, cadastros, edições, exclusões, recuperações e mudanças de permissões, com usuário e horário de Recife. Começa na ativação da migração; entradas repetidas em um minuto são agrupadas. Operações de servidor sem usuário autenticado aparecem como **Sistema**. Não registra senhas nem IPs. Os dados privados não entram no JSON público do site.

Na lixeira, **Ver informações** mostra o conteúdo preservado, quem excluiu, quando e as métricas individuais de cliques e exibições do link. A consulta abrange até 10 mil eventos e informa quando atinge esse limite. Eventos antigos que usavam posição, anteriores à medição individual, não são atribuídos ao item. Links iguais compartilham as métricas da mesma divulgação.

Verificação de interface: `JSDOM_MODULE=/caminho/node_modules/jsdom node --test tests/panel-records.test.cjs tests/native-center.test.cjs tests/panel-mobile.test.cjs`. Verificação das transações, permissões e recuperação em PostgreSQL/WASM: `PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite node --test tests/trash-db.test.cjs`.

## Envio de imagens

Novos arquivos JPG, PNG e WebP são ajustados no navegador antes do envio, com orientação da foto respeitada e sem distorção. A capa usa 1440 × 960 px; hospedagens, 1000 × 1000; destinos, 1200 × 800; destaques, 900 × 900. Essas fotos recebem recorte de preenchimento. Produtos usam 1000 × 1000 com a imagem inteira centralizada sobre fundo branco. O arquivo preparado é enviado tanto no modo local quanto ao Supabase. O limite continua em 5 MB; imagens acima de 40 megapixels são recusadas. GIFs preservam o arquivo original e a animação; vídeos seguem seu fluxo próprio. Imagens antigas e links externos mantêm o arquivo original, com o enquadramento feito pelo layout do site. Não requer SQL adicional.

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

## Assistente e desempenho da MegaBio

A visão geral reúne visitas, cliques, exibições de divulgações, movimento diário, ranking e o **Assistente MegaBio**. É uma análise automática por regras sobre os dados registrados, sem serviço externo de IA, sem chave adicional e sem alterar conteúdos. Os botões **O que divulgar?**, **O que é mais visto?** e **Como melhorar?** explicam os sinais do período, reconhecem empates e informam quando ainda faltam dados. As recomendações não afirmam vendas ou reservas.

O filtro oferece 7, 30, 90 dias e todo o histórico. O dia começa à meia-noite de Recife; o gráfico mostra até 30 dias. Eventos no Supabase são lidos em páginas de 500, até 10 mil por consulta. Se esse limite for atingido, o painel identifica a limitação e não apresenta dias ausentes como zeros completos. O modo local usa os totais acumulados da API local e mantém o filtro desativado.

As novas exibições individuais usam o evento existente `section`, com ID `view:promo_...`. Elas começam após a publicação desta atualização: registram um link pelo menos 50% visível por 1 segundo, com a página em primeiro plano, uma vez por divulgação por carregamento. Os IDs combinam seção e endereço de destino, preservando a identidade quando cartões mudam de posição. Links duplicados com o mesmo destino dentro da mesma seção contam como a mesma divulgação. Cliques podem se repetir e não representam pessoas únicas. Não há coleta adicional de localização ou identificação pessoal.

Eventos antigos continuam nos relatórios e nos totais: cliques históricos não são atribuídos a novos cartões por posição. Visualizações antigas de seções ficam separadas das exibições individuais. Não é necessário executar novo SQL: os tipos de evento e as permissões existentes são preservados. O assistente, gráficos e métricas exigem **Relatórios**; atalhos de edição só aparecem para as seções permitidas.

Testes de análise e medição:

```sh
node --test tests/megabio-analytics.test.cjs tests/promotion-observer.test.cjs
```

Os testes de integração de DOM usam `JSDOM_MODULE=/caminho/node_modules/jsdom node --test tests/megabio-dashboard.test.cjs tests/panel-mobile.test.cjs`. Eles cobrem navegação, permissões, exposição qualificada, cliques, paginação, filtros, respostas sem dados e falhas da consulta.

## Perfil, aparência e vídeo principal

Em **Perfil e aparência**, edite separadamente o **nome exibido na MegaBio** e o **título da aba do navegador**. O título é salvo em `profile.siteTitle` e não acompanha mudanças em `profile.name`. Conteúdo antigo recebe o título padrão “Casal no Mundo” até que um título próprio seja salvo.

A paleta fica em `profile.colors`: fundo, texto, destaque e fundo dos cartões. Há quatro combinações iniciais e seleção por cor ou código hexadecimal. **Restaurar cores padrão** volta à paleta original (`#ffffff`, `#171717`, `#f36b35`, `#ffffff`) sem alterar o nome, título ou capa. A prévia mostra as alterações em rascunho; elas só chegam à MegaBio após **Salvar alterações**. A personalização afeta a página pública, enquanto o painel mantém sua identidade de gestão.

A capa oferece **Imagem** ou **Vídeo** (`profile.heroType`). `profile.image` permanece como foto/capa alternativa; o vídeo fica em `profile.video`. São aceitos MP4 e WebM até 25 MB. O vídeo público tem controles, usa a foto como apresentação, não inicia automaticamente e volta à foto se o navegador não conseguir carregá-lo.

Os vídeos usam o bucket público `site-videos`, separado das imagens (que continuam limitadas a 5 MB). O servidor `/api/video-upload` valida o JWT e a permissão **Perfil**, então assina um caminho único em `videos/profile/`. O navegador envia o arquivo diretamente ao Supabase, evitando o limite de corpo da função da Vercel. A chave de servidor não é enviada ao navegador; só o token de um caminho de upload é retornado. Não há política pública de INSERT no bucket. Revogar a permissão bloqueia novas assinaturas e a publicação de alterações; assinaturas já emitidas seguem o prazo de validade do Supabase.

O bucket já está configurado nesta instalação. Para um projeto novo, execute opcionalmente [`supabase/videos.sql`](supabase/videos.sql), mantendo a mesma `SUPABASE_SECRET_KEY` de servidor usada pelo cadastro. O endpoint de assinatura funciona na Vercel/`vercel dev`; sem Supabase, o servidor Python oferece upload local de vídeo em `/api/media`. Arquivos locais continuam ignorados pelo Git e pela Vercel.

O link ao lado de **Sair** agora se chama **Visitar MegaBio** e continua apontando à página pública atual.

Testes específicos:

```sh
node --test tests/profile-design.test.cjs tests/video-api.test.cjs tests/image-upload.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py'
```

A validação de DOM de prévia, título independente, restauração de paleta e comportamento mobile usa `JSDOM_MODULE=/caminho/node_modules/jsdom node --test tests/profile-design.test.cjs tests/panel-mobile.test.cjs tests/megabio-dashboard.test.cjs`.
