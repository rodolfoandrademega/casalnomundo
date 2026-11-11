# Casal no Mundo

Link page estática com painel de edição e relatórios. Em produção, o conteúdo, o login administrativo e os eventos de analytics usam Supabase. A Vercel serve os arquivos estáticos e `/api/config`.

## Editor de Site

O menu **Site** abre um editor exclusivo dos acessos nativos. Outros membros veem **Em breve**, com a opção desativada; a função `save_site_sections` também bloqueia a gravação de `website` por não nativos no banco. Não foi criada uma permissão delegável para esta etapa.

Clique em **Criar meu site** para iniciar. O site deste projeto fica em **`/site`**, separado da MegaBio em `/`. Edite identidade, título da aba, apresentação, capa, tema claro/escuro, cor, sobre e contato. Adicione seções de hospedagens, destinos, passeios, lugares, combos, gastronomia/lanchonetes, lojas/achados, outras ofertas ou personalizadas. Cada indicação tem título, localização, descrição, imagem com upload, preço e condição, diferenciais, selo, duração, grupo/capacidade, ponto de encontro, parceiro, itens incluídos, orientações, mapa, texto/link do botão e datas opcionais de exibição. Os detalhes completos abrem em uma janela acessível. Use **Preparar categorias** para acrescentar os novos tipos em sites existentes ou **Trazer indicações da MegaBio** para copiar indicações públicas para o rascunho, sem duplicar cadastros. As datas usam Recife. Busca e filtros funcionam no site publicado e ignoram diferenças de acentos.

A prévia visual mostra o rascunho. **Prévia interativa** abre `/site?preview=1` e só libera a visualização de um site desativado depois de confirmar o acesso nativo; a prévia usa `noindex`. **Salvar site** grava somente `website`, preservando alterações pendentes da MegaBio. Para disponibilizar o conteúdo em `/site`, marque **Publicar o site** e salve. Desmarcar a publicação preserva o conteúdo e exibe uma página de novidades em breve. Use **Indicação ativa** e **Exibir esta seção** para ocultar e reativar itens, sem exclusão definitiva. Itens futuros, vencidos ou arquivados não aparecem; blocos vazios são omitidos. Os links levam aos canais externos cadastrados, sem sistema de reservas ou pagamentos próprio.

É um site compartilhado por este projeto, administrado pelos nativos, sem provisionamento de sites separados por usuário ou domínio nesta versão. Os campos devem conter somente informações públicas: `website` fica no payload público existente de `site_content`. As configurações antigas da MegaBio não são alteradas. O editor de indicações usa o Supabase e o armazenamento já configurados; o acervo privado abaixo exige uma migração separada. A publicação do código não cria ofertas nem ativa o site automaticamente.

Verificação: `JSDOM_MODULE=/caminho/node_modules/jsdom node --test tests/website.test.cjs tests/panel-mobile.test.cjs`; autorização no banco: `PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite node --test tests/access-db.test.cjs`.

## Acervo autoral: fotos e vídeos privados

As vendas ficam **desativadas**, conforme solicitado. Não há cobrança, criação de pedidos, comprovantes aceitos pelo navegador ou downloads para visitantes. `/api/premium-checkout` retorna `503 / SALES_NOT_ENABLED` independentemente do corpo enviado. Não basta cadastrar uma chave de pagamento: a futura integração precisará verificar os pagamentos no servidor e autorizar cada entrega antes de habilitar vendas.

1. Execute [`supabase/premium-media.sql`](supabase/premium-media.sql) no SQL Editor, depois de `access.sql` (e `trash.sql`, se o histórico estiver ativo). O SQL é reaplicável, preserva cadastros e mantém `premium-originals` privado. Não muda os buckets da MegaBio.
2. No admin, entre em **Site → Acervo de fotos e vídeos**. O acesso continua exclusivo dos nativos. A chave de servidor já usada em `SUPABASE_SECRET_KEY` prepara tokens de upload restritos a caminhos novos; nenhuma chave de servidor é enviada ao navegador.
3. Envie JPG, PNG, WebP, MP4 ou WebM de até 50 MB. O navegador gera uma prévia JPEG de até 960 px, com marcas d’água repetidas. Vídeos recebem uma prévia em imagem de um frame. O arquivo original não é redimensionado nem publicado. Ambos são enviados diretamente ao Storage, sem passar pelo limite de corpo das funções da Vercel.
4. Preencha título, descrição, localização, valor planejado e condições de licença. A prévia pode ser exibida ou arquivada sem apagar o original. Arquivar a retira do catálogo; prévias que já foram públicas podem continuar acessíveis por seus URLs, sempre com marca d’água. Metadados podem ser editados sem reenviar os arquivos.
5. Para mostrar o catálogo, ative **Exibir catálogo de prévias** no editor do Site, publique o site e marque as prévias desejadas como visíveis. Isso não ativa vendas. O público verá **Vendas em breve**. Não são criados produtos de exemplo nem condições de licenciamento fictícias.

Os originais e seus caminhos ficam em `premium_media`, com RLS exclusiva dos nativos; não entram em `site_content`, exportações JSON da MegaBio, `localStorage` ou respostas do catálogo público. A função `list_premium_media` devolve somente os campos da prévia e só lista produtos ativos quando o site e o acervo estão publicados. O endpoint público usa a chave publicável e ainda filtra os campos de saída. Os nativos podem abrir um original com URL assinada de 60 segundos. URLs assinadas podem ser usadas por quem as possuir durante sua validade; não as compartilhe como links permanentes.

Nenhuma página web consegue impedir de modo confiável prints ou gravação de tela. A proteção desta etapa é manter os originais fora do conteúdo público e mostrar somente derivados menores com marca d’água. As prévias continuam visíveis e podem ser capturadas. Não há promessa de DRM nem bloqueios cosméticos de teclas apresentados como proteção real. Referências: [buckets privados do Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals) e [URLs temporárias](https://supabase.com/docs/guides/storage/serving/downloads).

O envio privado usa funções da Vercel; no servidor Python local, utilize o painel publicado para enviar originais. Testes: `node --test tests/premium-api.test.cjs tests/premium-preview.test.cjs`; com DOM, `JSDOM_MODULE=/caminho/node_modules/jsdom node --test tests/premium-editor.test.cjs tests/website.test.cjs`; com PostgreSQL/WASM, `PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite node --test tests/premium-db.test.cjs`.

## Configuração do Supabase

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

O visual público usa [`megabio.css`](megabio.css): composição centralizada, tipografia consistente, espaços proporcionais e cards adaptados ao celular. A navegação por seções aparece quando pelo menos dois blocos têm conteúdo e estão ativos, usando seus títulos personalizados; esses atalhos não são contabilizados como cliques em divulgações. Um único destino ocupa a largura disponível. Cores configuradas no perfil e estilos individuais dos destaques continuam sendo respeitados, sem aplicar efeitos nos botões de contato, redes ou lojas.

A página pública tolera listas incompletas e itens inválidos sem interromper as outras seções. Blocos sem conteúdo ficam ocultos. Links vazios ou inseguros não viram botões para `#`; imagens locais simples são aceitas, e imagens ausentes ou que falham recebem uma prévia neutra. As consultas de configuração/conteúdo têm prazo limitado e os dados estáticos publicados têm preferência sobre rascunhos antigos do navegador quando o backend não responde. Há estado de carregamento, foco visível, atalho para o conteúdo, textos com quebra e áreas de toque maiores no celular. A imagem de capa pode ocupar menos altura em telas estreitas; GIFs e vídeos mantêm seu comportamento. Os efeitos continuam exclusivos dos cards de destaques e respeitam movimento reduzido. Verificações de regressão: `JSDOM_MODULE=/caminho/node_modules/jsdom node --test tests/public-page.test.cjs tests/megabio-dashboard.test.cjs tests/promotion-observer.test.cjs`.

Visitas, cliques e seções vistas são registrados sem IP ou identificador individual. O rodapé não oferece coleta de localização. O relatório de regiões preserva somente os dados históricos compartilhados com consentimento, sem solicitar novas localizações.

## Listas, lixeira e histórico nativo

Em **Destaques → Editar → Aparência do card inteiro**, configure o fundo, texto, borda, ritmo e animação de cada card. O flash atravessa o destaque completo, incluindo a área da imagem, sem criar botões internos. A prévia usa um rascunho isolado; **Salvar item** publica a mudança, seguindo a permissão Destaques. **Restaurar card padrão** remove as personalizações do item em edição. As configurações ficam em `highlights[].card` e são preservadas na lixeira. Sem configuração, o card mantém o visual anterior, sem animação. O cartão continua sendo um único link, preservando as métricas. Não exige SQL.

As cores e animações de destaque são exclusivas dos cards em **Destaques → Editar → Aparência do card inteiro**. As configurações antigas de `profile.buttons` são ignoradas e os controles globais foram removidos: contato, redes e lojas mantêm seu estilo original. O CSS usa apenas atributos e variáveis exclusivos dos cards. Escolher uma cor ativa automaticamente a personalização daquele card.

Em **Perfil e aparência → Seções da MegaBio**, quem tem permissão **Perfil** pode ativar/desativar Hospedagens, Destinos, Destaques, Produtos e Redes e contato e personalizar seus títulos públicos. Clique em **Salvar alterações** para publicar. Desativar apenas oculta o bloco, preservando os itens para reativação; não move nada para a lixeira. Redes e contato são controlados juntos. As configurações ficam em `profile.sections`, usam as permissões existentes e não exigem novo SQL. Conteúdos antigos sem essa configuração mantêm todas as seções ativas com os títulos originais; um título vazio restaura o padrão. Os identificadores de analytics e os nomes do menu administrativo permanecem estáveis.

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
