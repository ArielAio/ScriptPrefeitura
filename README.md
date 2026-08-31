# Fluxo SCPI

Extensão local do Chrome que executa procedimentos assistidos na sessão já
autenticada do SCPI 9.0. A extensão também possui um leitor local de fotos de
orçamentos. O OCR é executado pelo macOS e nenhuma imagem é enviada à internet.
Nenhuma fase salva dados.

Na tela inicial, **Documentação** reúne os materiais de apoio incluídos na
extensão. O primeiro documento disponível é **Padrão do XLSX de
abastecimentos**, com as colunas obrigatórias, formatos aceitos, exemplos,
regra do maior KM por placa e correções para os erros mais comuns.

O projeto automatiza tarefas repetitivas, mas mantém a conferência humana antes
da gravação definitiva no SCPI. Ele não armazena credenciais, planilhas ou fotos
no repositório e não é uma extensão oficial da Fiorilli ou do município.

## Funcionalidades

- criação assistida de solicitações e inclusão de produtos;
- preparação de cotações e pesquisa de fornecedores por CNPJ;
- importação local de abastecimentos por XLSX, com consolidação do maior KM por placa;
- conferência e correção de quantidade, placa e quilometragem na grade;
- leitura local de fotos de orçamentos com OCR nativo do macOS;
- pausa, retomada e relatório visual de cada execução;
- interrupção antes do salvamento definitivo para revisão do operador.

## Instalação local

1. Abra `chrome://extensions` no mesmo perfil do Chrome usado no SCPI.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta clonada deste repositório.

## Execução

1. Deixe a aba `https://srv.sjduaspontes.sp.gov.br/scpi9/` ativa e autenticada.
2. Clique no ícone **Fluxo SCPI** na barra do Chrome e escolha
   **Solicitações e cotações**.
3. Na etapa 1, clique em **Iniciar e preencher dados**. A extensão abre uma nova
   solicitação, preenche Responsável e Descrição e para.
4. Depois de conferir, abra novamente a extensão e clique em
   **Abrir Itens da Solicitação** na etapa 2. Ela abre a aba de itens e para.
5. Depois de conferir, abra novamente a extensão e clique em
   **Pesquisar e inserir produtos** na etapa 3. A extensão pesquisa cada produto
   conferido, percorre as páginas de resultados e insere correspondências
   seguras. Para cada resultado, ela clica em **Confirmar**, espera a pesquisa
   fechar e abre **[Insert] Novo Item** antes do próximo produto, evitando
   sobrescrever o item anterior. Quando não encontra ou há mais de uma opção
   parecida, ela avisa e pausa no produto atual para conferência manual.
   A pesquisa usa a descrição completa primeiro, espera pelo menos um segundo
   entre carregamentos e para imediatamente ao encontrar o nome exato. Cada
   tentativa percorre no máximo três páginas; falhas temporárias usam esperas
   progressivas de 2, 4 e 8 segundos. Ao atingir o limite ou detectar bloqueio,
   excesso de requisições ou sessão expirada, a extensão interrompe o processo.
   Se a página do SCPI for atualizada, a extensão compara o progresso salvo com
   a grade visível e retoma do primeiro produto que realmente estiver faltando.
   Depois de incluir todos os produtos, ela percorre a coluna **Quantidade** na
   mesma ordem dos itens extraídos, altera somente os valores diferentes e
   confirma cada resultado na grade. Ela ainda para antes de salvar para a
   conferência humana.
6. Com todos os produtos conferidos, clique em **Continuar para Cotação** na
   etapa 4. Ela abre Processo de Compra, Cotação, inicia uma nova cotação,
   clica em **Incluir** e abre a pesquisa de solicitações. O
   processo para sem salvar.
7. Depois de incluir manualmente a solicitação na cotação, abra a aba necessária
   e clique em **Cadastrar fornecedores** na etapa 5. A extensão abre
   **Fornecedores**,
   pesquisa cada CNPJ conferido no modo adaptativo e confirma somente uma
   correspondência com o mesmo documento. CNPJs que já aparecem na
   grade são ignorados. Se um fornecedor não estiver cadastrado, a extensão
   deixa a pesquisa aberta, avisa o CNPJ pendente e para para inclusão manual.

Durante uma etapa, **Pausar** interrompe a sequência no próximo ponto seguro e
o botão muda para **Continuar**. **Cancelar** encerra somente a automação atual:
ele não clica em Cancelar, não salva e não descarta dados dentro do SCPI.
**Finalizar** encerra no próximo ponto seguro e mantém no painel um relatório
com o progresso e todos os resultados obtidos até aquele momento.
Enquanto uma execução estiver ativa, um painel animado permanece fixo dentro da
própria página do SCPI. Ele mostra etapa, item atual, total e barra de progresso,
além dos controles **Pausar/Continuar** e **Cancelar**. O painel não depende de o
popup da extensão continuar aberto.

Depois de carregar o XLSX, abra **Conferências e correções**.
**Conferir e corrigir quantidades** compara cada QTD e corrige somente as
divergentes. **Conferir e corrigir placas** refaz a busca do
centro de custo de cada item, confere o resultado diretamente na coluna
**Placa (F9)**, atualiza as divergentes e, ao final, lista as placas que não
foram encontradas sem interromper as demais conferências. Espaços de formatação
do SCPI, como `UDP 0D49`, não alteram a comparação com a placa do XLSX. Antes
de abrir **F3 - C.Custo**, a extensão seleciona a célula da linha-alvo pelo
fluxo normal da grade e confirma que o registro ficou ativo; o fluxo não avança
se o SCPI mantiver outra linha selecionada. Essa proteção também é aplicada na
primeira importação completa, antes de preencher cada centro de custo.
A opção **Permitir KM menor e pausar para eu escolher Sim ou Não** fica ativada
por padrão. Se a troca da placa fizer o SCPI avisar que o **KM Atual é menor que
o KM Anterior**, a extensão deixa a confirmação aberta, pausa e aguarda a sua
decisão. No modo conservador, um KM menor não é digitado.
Quando houver falhas, o painel final mostra uma lista rolável com item, placa,
etapa e a mensagem técnica completa de cada problema.

**Conferir e corrigir KM Atual** percorre a coluna **Atual**, confirma que a
placa da linha corresponde à placa do XLSX e corrige os valores divergentes. Se
o SCPI perguntar **“Confirma virada de velocímetro?”**, a execução pausa sem
clicar em **Sim** ou **Não**. Depois da decisão no SCPI, use o botão
correspondente da extensão para continuar.
Uma falha de edição é registrada no relatório e não impede a conferência dos
demais KMs.
As etapas não dependem do progresso salvo pela extensão: se você concluir uma
parte manualmente, pode executar diretamente o próximo botão. A extensão apenas
confere se os controles necessários existem na tela atual.

Use **Resetar dados da extensão** para apagar produtos, fornecedores, progresso
e itens pendentes antes de começar outro cadastro. A ação pede confirmação e
não altera a sessão nem os dados do SCPI.

Use **Atualizar extensão** depois que os arquivos locais forem modificados. A
ação pede confirmação, apaga o XLSX, o progresso e os demais dados locais
antigos e recarrega a extensão pelo Chrome. Ela não altera dados do SCPI.

## Abastecimentos por XLSX

1. Abra uma **Requisição de Saída** nova, na aba **Itens da Saída**, com a grade vazia.
2. Abra a extensão e selecione o arquivo `.xlsx` em **Abastecimentos por XLSX**.
3. A extensão invalida a sessão anterior antes de analisar o novo arquivo,
   valida o arquivo inteiro e mantém somente **Placa**, **KM**, **Combustível** e
   **Litros**. São aceitos até 500 abastecimentos; KM deve ser um inteiro seguro
   e Litros deve usar formato decimal comum, sem notação científica. Para cada
   placa, todas as linhas recebem o maior KM encontrado no arquivo. Um arquivo
   inválido não reativa os dados do XLSX anterior.
4. Clique em **Importar XLSX e preencher**. Para cada linha, a extensão confirma
   no **Produto do Pedido** a única opção que contenha **Etanol**, **Diesel** ou
   **Gasolina**, conforme o valor da coluna **Combustível** do XLSX, pesquisa o
   **Centro de Custo** pela placa, desloca a grade até as últimas colunas e
   atualiza **Atual**. Somente depois de cadastrar todos os itens, a extensão
   volta ao início da grade e preenche todas as **QTDs** em sequência pelo
   mecanismo de edição do ExtJS. Cada gravação confirmada aguarda 1 segundo
   antes de a extensão avançar, para o SCPI concluir o cálculo e atualizar o
   dataset interno.
   O botão **F2 - Produto** permanece visível durante o processo. Se o SCPI
   ignorar uma tentativa de abertura do menu, a extensão clica novamente até
   **Produto do Pedido** aparecer.
   Durante a execução, o popup exibe o andamento como **Item 1 de X** e, na
   etapa final, **QTD 1 de X**, junto da operação atual.
5. Quando mais de um centro de custo contém a mesma placa, a pesquisa fica aberta
   e a execução pausa. Escolha e confirme o registro correto no SCPI; depois use
   **Já escolhi a placa — continuar** na extensão.
6. Antes de alterar **Atual**, a extensão compara o KM do XLSX com **Anterior**.
   Com a opção de virada ativada, o maior KM daquela placa no XLSX é inserido
   mesmo sendo menor que o anterior. Se o SCPI pedir confirmação de virada, a
   extensão pausa e deixa **Sim** e **Não** para a decisão humana. Desative a
   opção para usar o modo conservador: um KM menor não é digitado. KM igual ou
   maior continua permitido nos dois modos. A preferência é preservada ao
   limpar os dados da extensão.
   Quando o SCPI mostrar **Quilometragem MUITO ALTA. Verifique!**, a extensão
   pausa sem confirmar **OK**.
7. Ao terminar, confira toda a grade. A extensão não aciona o botão **Salvar**.

O progresso dos itens e o progresso das QTDs são armazenados separadamente e
vinculados à aba do SCPI onde o XLSX foi iniciado. A retomada em outra aba é
recusada para impedir que índices salvos sejam aplicados a outra requisição. Se
a etapa final for interrompida, a extensão retoma diretamente da primeira QTD
pendente. Falhas parciais permanecem como pendências, mesmo quando outros itens
foram processados. Antes de retomar ou editar, a extensão valida o produto e a
placa esperados na linha; uma grade reordenada interrompe o fluxo. Se alguma
etapa falhar, o erro mostra item, etapa, placa, combustível, litros esperados,
KM do XLSX, valor encontrado e os métodos de edição tentados.
Os alertas transitórios de grade ocupada ou dataset fora do modo de edição são
fechados pela extensão; a célula é reaberta e repetida sem avançar o item.
As ações usam intervalo adaptativo: operações comuns aguardam no mínimo 250 ms,
enquanto confirmações, paginação e gravações de QTD/KM preservam a margem de 1
segundo. Em todos os casos, a extensão só avança depois que o Ajax e a máscara
de carregamento terminam. Após `Ajax Error`, `dirty state` ou dataset ainda fora
do modo de edição, todas as ações voltam temporariamente à margem conservadora.
Se o uniGUI exibir `Ajax Error`, a extensão fecha o aviso para liberar a página,
mas interrompe a operação atual porque não há confirmação segura de que o SCPI
a tenha concluído.
Se, mesmo após as tentativas, um KM ou uma QTD continuar sem aceitar edição, o
campo é registrado como pulado e a extensão segue para o próximo. Falhas de
sessão, bloqueio do SCPI e escolhas ambíguas continuam interrompendo o fluxo.

Antes de editar QTD ou KM, a extensão espera a grade terminar o carregamento e
ficar estável. Se o uniGUI responder `Grid is in dirty state`, o alerta é
capturado, a extensão aguarda a atualização pendente terminar e repete a célula
sem avançar o progresso. Um editor realmente desabilitado ou somente leitura
não é liberado à força.

O XLSX é processado localmente com a cópia vendorizada do SheetJS Community
Edition. Nenhum conteúdo da planilha é enviado à internet.

Após modificar os arquivos, use **Recarregar** em `chrome://extensions` antes
do próximo teste e confirme a versão exibida ao lado de **Fluxo SCPI**.

## Leitor de orçamentos

1. Execute uma vez `./scripts/install-native-host.sh`. O instalador compila o
   leitor e configura automaticamente o caminho atual e o ID da extensão
   carregada sem compactação. Se o Chrome exibir um ID diferente, passe-o como
   argumento: `./scripts/install-native-host.sh ID_DA_EXTENSAO`.
2. Recarregue a extensão em `chrome://extensions`.
3. Abra a extensão, escolha **Solicitações e cotações** e clique em
   **Ler fotos dos orçamentos**.
4. Arraste de uma a três imagens JPEG, PNG ou HEIC para qualquer ponto da página;
   a extração começa automaticamente. O seletor e **Extrair dados** continuam
   disponíveis como alternativa.
5. Confira CNPJ do fornecedor, código, descrição, quantidade e valores com os
   documentos originais. O leitor também compara a soma dos itens com o total
   impresso no pedido. Prefixos como **Item 1** e traços iniciais são removidos
   do nome; use **Adicionar item** ou **Excluir** para corrigir a lista manualmente.
6. Clique em **Usar produtos e fornecedores** para disponibilizar os produtos
   ao passo 3 e os CNPJs ao passo 5 da extensão. Um CNPJ válido e diferente do
   CNPJ da prefeitura é exigido para cada documento.

O modelo de Pedido de Empenho do município já está calibrado pela posição das
colunas e pelo código dos produtos. Por segurança, os resultados são apenas
exibidos para conferência e ainda não são enviados ao SCPI.

## Verificação do código

```bash
npm test
npm run check
```
