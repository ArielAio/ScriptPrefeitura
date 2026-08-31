#!/usr/bin/env python3
"""Gera os dois PDFs de operação distribuídos com a extensão."""

from pathlib import Path
import json

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
LOGO = ROOT / "assets" / "fluxo-scpi-logo.png"
VERSION = json.loads((ROOT / "manifest.json").read_text())["version"]
REVISION = "31 de agosto de 2026"
REVISION_SHORT = "31/08/2026"

NAVY = colors.HexColor("#172B3E")
TEAL = colors.HexColor("#007C78")
TEAL_DARK = colors.HexColor("#006A66")
GOLD = colors.HexColor("#B87300")
CREAM = colors.HexColor("#FFF4DC")
PALE = colors.HexColor("#EEF4F7")
MUTED = colors.HexColor("#607286")
LINE = colors.HexColor("#C6D5DE")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN_X = 19 * mm
CONTENT_BOTTOM = 18 * mm
CONTENT_TOP = 18 * mm


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    "CoverEyebrow", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10, leading=12, textColor=TEAL, alignment=TA_CENTER, spaceAfter=7,
))
styles.add(ParagraphStyle(
    "CoverTitle", parent=styles["Title"], fontName="Helvetica",
    fontSize=28, leading=32, textColor=NAVY, alignment=TA_CENTER, spaceAfter=9,
))
styles.add(ParagraphStyle(
    "CoverSubtitle", parent=styles["Normal"], fontName="Helvetica",
    fontSize=12, leading=16, textColor=MUTED, alignment=TA_CENTER, spaceAfter=22,
))
styles.add(ParagraphStyle(
    "Heading", parent=styles["Heading1"], fontName="Helvetica",
    fontSize=20, leading=24, textColor=NAVY, spaceAfter=9,
))
styles.add(ParagraphStyle(
    "Subheading", parent=styles["Heading2"], fontName="Helvetica",
    fontSize=14, leading=17, textColor=TEAL_DARK, spaceBefore=8, spaceAfter=5,
))
styles.add(ParagraphStyle(
    "Body", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.6, leading=13.2, textColor=NAVY, spaceAfter=6,
))
styles.add(ParagraphStyle(
    "Small", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.4, leading=11, textColor=NAVY,
))
styles.add(ParagraphStyle(
    "Table", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.1, leading=10.3, textColor=NAVY,
))
styles.add(ParagraphStyle(
    "TableHead", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=8.2, leading=10.3, textColor=WHITE,
))
styles.add(ParagraphStyle(
    "CalloutTitle", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=10, leading=12, textColor=NAVY, spaceAfter=4,
))
styles.add(ParagraphStyle(
    "DocBullet", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.4, leading=12.5, textColor=NAVY, leftIndent=13,
    firstLineIndent=-9, bulletIndent=0, spaceAfter=3,
))


def paragraph(text, style="Body"):
    return Paragraph(text, styles[style])


def bullets(items, marker="-"):
    return [Paragraph(item, styles["DocBullet"], bulletText=marker) for item in items]


def heading(text):
    return Paragraph(text, styles["Heading"])


def subheading(text):
    return Paragraph(text, styles["Subheading"])


def callout(title, text, color=CREAM):
    content = [paragraph(title, "CalloutTitle"), paragraph(text, "Body")]
    box = Table([[content]], colWidths=[PAGE_W - (2 * MARGIN_X) - 8 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), 0.6, GOLD),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return KeepTogether([box, Spacer(1, 5)])


def table(rows, widths, header=True, compact=False):
    converted = []
    for row_index, row in enumerate(rows):
        style_name = "TableHead" if header and row_index == 0 else ("Small" if compact else "Table")
        converted.append([
            value if hasattr(value, "wrap") else paragraph(str(value), style_name)
            for value in row
        ])
    result = Table(converted, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        commands.append(("BACKGROUND", (0, 0), (-1, 0), TEAL_DARK))
        if len(rows) > 2:
            commands.append(("BACKGROUND", (0, 2), (-1, -1), PALE))
    result.setStyle(TableStyle(commands))
    return result


def step(number, owner, title, text):
    number_box = Table([[paragraph(str(number), "TableHead")]], colWidths=[10 * mm], rowHeights=[10 * mm])
    number_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_DARK),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    body = [
        paragraph(f"<b>{owner}</b> | {title}", "Small"),
        paragraph(text, "Small"),
    ]
    row = Table([[number_box, body]], colWidths=[13 * mm, PAGE_W - (2 * MARGIN_X) - 13 * mm])
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return KeepTogether([row, Spacer(1, 2)])


def cover(title, subtitle, eyebrow, callout_title, callout_text, metadata):
    logo = Image(str(LOGO), width=42 * mm, height=42 * mm)
    logo.hAlign = "CENTER"
    metadata_rows = [[paragraph(key, "Small"), paragraph(value, "Small")] for key, value in metadata]
    metadata_table = Table(metadata_rows, colWidths=[34 * mm, 101 * mm])
    metadata_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), NAVY),
        ("TEXTCOLOR", (0, 0), (0, -1), WHITE),
        ("BACKGROUND", (1, 0), (1, -1), PALE),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return [
        Spacer(1, 25 * mm), logo, Spacer(1, 10 * mm),
        paragraph(eyebrow, "CoverEyebrow"),
        paragraph(title, "CoverTitle"),
        paragraph(subtitle, "CoverSubtitle"),
        callout(callout_title, callout_text),
        Spacer(1, 14 * mm), metadata_table,
        NextPageTemplate("content"), PageBreak(),
    ]


def add_pages(story, pages):
    for page_index, page in enumerate(pages):
        story.extend(page)
        if page_index < len(pages) - 1:
            story.append(PageBreak())


def on_cover(canvas, doc):
    canvas.setTitle(doc.title)
    canvas.setAuthor("Prefeitura Municipal - Fluxo SCPI")
    canvas.setSubject(doc.subject)


def on_content(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_X, PAGE_H - 14 * mm, PAGE_W - MARGIN_X, PAGE_H - 14 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(TEAL_DARK)
    canvas.drawString(MARGIN_X, PAGE_H - 10.5 * mm, doc.header_left)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 10.5 * mm, doc.header_right)
    canvas.line(MARGIN_X, 13 * mm, PAGE_W - MARGIN_X, 13 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(MARGIN_X, 8.5 * mm, f"Versão da extensão {VERSION} - {REVISION_SHORT}")
    canvas.drawRightString(PAGE_W - MARGIN_X, 8.5 * mm, f"Página {doc.page}")
    canvas.restoreState()


def build_pdf(path, title, subject, header_left, header_right, cover_flowables, pages):
    doc = BaseDocTemplate(
        str(path), pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=CONTENT_TOP, bottomMargin=CONTENT_BOTTOM,
        title=title, author="Prefeitura Municipal - Fluxo SCPI", subject=subject,
    )
    doc.title = title
    doc.subject = subject
    doc.header_left = header_left
    doc.header_right = header_right
    cover_frame = Frame(MARGIN_X, CONTENT_BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - 2 * CONTENT_BOTTOM, id="cover")
    content_frame = Frame(
        MARGIN_X, CONTENT_BOTTOM, PAGE_W - 2 * MARGIN_X,
        PAGE_H - CONTENT_BOTTOM - CONTENT_TOP, id="content", topPadding=3 * mm,
    )
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=on_cover),
        PageTemplate(id="content", frames=[content_frame], onPage=on_content),
    ])
    story = list(cover_flowables)
    add_pages(story, pages)
    doc.build(story)


def manual_pages():
    available = PAGE_W - 2 * MARGIN_X
    return [
        [
            heading("1. Objetivo e limites do processo"),
            paragraph("Este manual ensina a usar <b>Abastecimentos por XLSX</b> para preparar os itens de uma Requisição de Saída no SCPI. Cada linha válida vira um item com produto, centro de custo/placa, KM Atual e quantidade em litros."),
            table([
                ["Responsável", "O que faz"],
                ["Operador", "Prepara e revisa o XLSX; abre a tela correta; resolve escolhas e avisos; confere a grade; salva somente depois da validação."],
                ["Fluxo SCPI", "Valida a planilha; usa o maior KM por placa; inclui itens; preenche KM e QTD; registra progresso e pendências; nunca salva."],
                ["SCPI", "Mantém os cadastros oficiais e apresenta validações como virada de velocímetro, KM muito alto e erros Ajax."],
            ], [31 * mm, available - 31 * mm]),
            subheading("Escopo deste manual"),
            paragraph("O documento começa com a planilha pronta e termina na conferência da grade. A autorização administrativa, os comprovantes e as regras internas de aprovação continuam seguindo os procedimentos da Prefeitura."),
            subheading("Fluxo resumido"),
            table([
                ["1", "2", "3", "4", "5", "6"],
                ["Preparar XLSX", "Abrir grade vazia", "Importar", "Resolver pausas", "Conferir", "Salvar manualmente"],
            ], [available / 6] * 6, header=False, compact=True),
        ],
        [
            heading("2. Antes de começar"),
            subheading("Condições obrigatórias"),
            *bullets([
                "Chrome no perfil em que a extensão Fluxo SCPI está instalada.",
                "Sessão do SCPI 9.0 autenticada e funcionando.",
                "Uma Requisição de Saída nova, na aba Itens da Saída, com a grade vazia.",
                "Arquivo .xlsx de até 20 MB, com no máximo 500 abastecimentos e as quatro colunas obrigatórias.",
                "Tempo para acompanhar as pausas e fazer a conferência humana no final.",
            ]),
            callout("Não comece em uma grade com itens", "Se já houver itens, pare e confirme se abriu o registro correto. O fluxo valida produtos e placas ao retomar, mas uma importação nova deve começar em grade vazia."),
            subheading("Checklist rápido de abertura"),
            *bullets([
                "Estou na Requisição de Saída correta.",
                "A aba Itens da Saída está aberta e a grade está vazia.",
                "A planilha corresponde ao período e ao lote que vou lançar.",
                "Não há outra execução do Fluxo SCPI ativa nesta tela.",
            ], marker="□"),
            subheading("O que a extensão não faz"),
            *bullets([
                "Não decide qual centro de custo usar quando a placa aparece em mais de um cadastro.",
                "Não escolhe Sim, Não ou OK em avisos de hodômetro.",
                "Não substitui a conferência visual de produtos, placas, KMs e litros.",
                "Não clica em Salvar.",
            ]),
        ],
        [
            heading("3. Como preparar a planilha XLSX"),
            paragraph("A extensão usa a primeira aba válida que contenha, na mesma linha de cabeçalho, <b>Placa</b>, <b>KM</b>, <b>Combustível</b> e <b>Litros</b>. Outras colunas são ignoradas."),
            table([
                ["Coluna", "Formato esperado", "Exemplo"],
                ["Placa", "Placa brasileira com 7 caracteres; hífen e espaços são removidos.", "ABC1D23"],
                ["KM", "Inteiro seguro, igual ou maior que zero, sem ponto de milhar ou notação científica.", "43745"],
                ["Combustível", "Texto que identifique Etanol, Diesel ou Gasolina.", "ETANOL HIDRATADO"],
                ["Litros", "Número maior que zero em formato decimal comum; não use 1e3.", "20,5"],
            ], [25 * mm, 102 * mm, available - 127 * mm]),
            subheading("Regra do maior KM por placa"),
            paragraph("Se a mesma placa aparecer várias vezes, todas as linhas recebem o maior KM encontrado para ela. Um valor menor nunca substitui o maior valor daquela placa."),
            callout("O arquivo inteiro é validado", "Uma linha relevante inválida bloqueia o carregamento. Um arquivo novo invalida a sessão anterior antes da leitura; se ele for rejeitado, os dados antigos não reaparecem."),
            subheading("Limites e privacidade"),
            *bullets([
                "No máximo 500 abastecimentos e 20 MB por arquivo.",
                "O XLSX é processado localmente pela cópia vendorizada do SheetJS.",
                "O Fluxo SCPI não envia o conteúdo da planilha para a internet.",
            ]),
        ],
        [
            heading("4. Importar e preencher os abastecimentos"),
            step(1, "OPERADOR", "Abra o Fluxo SCPI", "Na barra do Chrome, clique no ícone da extensão e escolha Abastecimentos."),
            step(2, "OPERADOR", "Selecione a planilha", "Escolha o .xlsx e aguarde a mensagem com o número de lançamentos e placas."),
            step(3, "OPERADOR", "Confira o resumo", "Se nome, quantidade ou placas não corresponderem ao lote, não prossiga."),
            step(4, "OPERADOR", "Defina o tratamento de KM menor", "Ativado: o valor menor é inserido e a extensão pausa para você escolher Sim ou Não. Desativado: o KM menor não é digitado."),
            step(5, "OPERADOR", "Inicie", "Clique em Importar XLSX e preencher. O arquivo fica vinculado à aba atual do SCPI."),
            step(6, "EXTENSÃO", "Inclua os itens", "Seleciona o produto compatível, pesquisa o centro de custo pela placa e preenche KM Atual."),
            step(7, "EXTENSÃO", "Preencha as quantidades", "Depois de todos os itens, volta ao início e preenche as QTDs na ordem do XLSX."),
            step(8, "EXTENSÃO", "Pare antes de salvar", "Mostra o resultado e deixa a tela pronta para conferência. Nunca salva."),
            callout("Acompanhe a tela", "O painel mostra Item N de X ou QTD N de X. Não use a grade em paralelo. Se o Chrome estiver em outra aba do SCPI, a retomada é recusada."),
        ],
        [
            heading("5. O que acontece em cada item"),
            table([
                ["Ordem", "Ação", "O que observar"],
                ["1", "Abre F2 - Produto e Produto do Pedido.", "O menu correto deve aparecer; a extensão repete o clique se necessário."],
                ["2", "Seleciona opção compatível com o combustível.", "Confira se o produto da linha é o esperado."],
                ["3", "Cria Novo Item quando necessário.", "Cada abastecimento deve ocupar uma linha própria."],
                ["4", "Abre F3 - C.Custo e pesquisa a placa.", "A placa correta deve aparecer em Placa (F9)."],
                ["5", "Preenche KM Atual após comparar com Anterior.", "Avisos de virada ou KM alto sempre exigem decisão humana."],
                ["6", "Após todos os itens, preenche QTD.", "Compare litros e ordem com o XLSX."],
            ], [15 * mm, 68 * mm, available - 83 * mm]),
            subheading("Proteções durante a execução"),
            *bullets([
                "A extensão aguarda grade, Ajax e máscara de carregamento terminarem.",
                "Produtos e placas já existentes são validados antes da retomada; linha incompatível interrompe o fluxo.",
                "A edição direta pelo ExtJS só é aceita quando o plugin de edição existe e confirma a alteração; caso contrário, usa o editor visível.",
                "Dirty state e dataset fora do modo de edição são aguardados e repetidos sem avançar o índice.",
                "Ajax Error é fechado para liberar a tela, mas a operação para porque não há confirmação segura de sucesso.",
            ]),
        ],
        [
            heading("6. KM anterior, KM atual e virada de velocímetro"),
            paragraph("Antes de escrever KM Atual, o Fluxo SCPI compara o maior KM da placa no XLSX com o KM Anterior do SCPI."),
            table([
                ["Situação", "Opção ativada", "Modo conservador"],
                ["KM maior ou igual ao Anterior", "Preenche normalmente.", "Preenche normalmente."],
                ["KM menor que o Anterior", "Insere o KM e pausa com a pergunta de virada aberta. O operador escolhe Sim ou Não.", "Não reduz o KM e mantém o campo sem alteração."],
                ["Quilometragem MUITO ALTA", "Pausa sem clicar em OK.", "Pausa sem clicar em OK."],
            ], [46 * mm, 65 * mm, available - 111 * mm]),
            callout("A decisão é sempre humana", "A extensão não confirma nem recusa virada de velocímetro. Leia o aviso, confira placa, KM Anterior e documento de origem e só então escolha no SCPI."),
            subheading("Conferência obrigatória de KM"),
            *bullets([
                "Compare Atual com o maior KM de cada placa no XLSX.",
                "Confira se a placa da linha é a mesma usada para calcular o KM.",
                "Revise KMs ignorados, pendentes e associados a uma virada.",
                "Não salve um KM improvável apenas porque o SCPI permitiu a confirmação.",
            ]),
        ],
        [
            heading("7. Pausas e decisões manuais"),
            subheading("Placa com mais de um centro de custo"),
            paragraph("A extensão mantém a pesquisa aberta e pausa. Compare veículo, setor e centro de custo; confirme o registro no SCPI e use <b>Já escolhi a placa - continuar</b>."),
            subheading("Virada ou quilometragem muito alta"),
            paragraph("A execução deixa o aviso aberto. Confira os dados e escolha Sim, Não ou OK diretamente no SCPI. Depois retome pela extensão. Nenhuma dessas decisões é automática."),
            table([
                ["Controle", "Efeito"],
                ["Pausar", "Interrompe no próximo ponto seguro; o botão muda para Continuar."],
                ["Continuar", "Retoma a mesma execução a partir do progresso seguro."],
                ["Cancelar", "Encerra somente a automação; não cancela nem descarta dados no SCPI."],
                ["Finalizar", "Encerra no próximo ponto seguro e mantém o relatório parcial."],
            ], [34 * mm, available - 34 * mm]),
            callout("Tela ou sessão inesperada", "Se a sessão expirar, o SCPI bloquear, aparecer Ajax Error ou a grade não corresponder ao XLSX, a execução é interrompida. Estabilize a tela e confira o progresso antes de tentar novamente."),
        ],
        [
            heading("8. Conferências e correções"),
            paragraph("As ações comparam a grade atual com o XLSX carregado e alteram somente divergências."),
            table([
                ["Ação", "O que verifica", "Resultado esperado"],
                ["Quantidades", "Placa, produto e QTD de cada linha.", "Mantém as corretas e corrige somente as diferentes."],
                ["Placas", "Pesquisa o centro de custo e confere Placa (F9).", "Atualiza divergências e lista placas não encontradas."],
                ["KM Atual", "Confirma placa e compara Atual com o maior KM.", "Corrige divergências; pausa em decisões do hodômetro."],
            ], [40 * mm, 61 * mm, available - 101 * mm]),
            subheading("Ordem recomendada"),
            *bullets([
                "1. Conferir placas para garantir que cada linha representa o veículo certo.",
                "2. Conferir KM Atual já associado à placa correta.",
                "3. Conferir quantidades linha a linha.",
                "4. Ler o relatório e resolver cada pendência antes de salvar.",
            ]),
            callout("Pendências não viram conclusão", "Se um KM ou QTD falhar, o índice volta ao primeiro campo pendente e o botão mostra Continuar pendências. Outros itens podem ser processados, mas a execução não é apresentada como concluída."),
        ],
        [
            heading("9. Problemas comuns e ação segura"),
            table([
                ["Mensagem ou sintoma", "Ação segura"],
                ["Quatro colunas não localizadas", "Use Placa, KM, Combustível e Litros na mesma linha de cabeçalho."],
                ["Corrija o XLSX", "Leia a linha indicada, corrija o arquivo e selecione-o novamente. O cache antigo já foi invalidado."],
                ["Mais de um centro para a placa", "Escolha manualmente o registro correto e continue pela extensão."],
                ["Linha pertence a outro produto/placa", "Pare. Confirme a requisição e a ordem da grade; não force a retomada."],
                ["XLSX iniciado em outra aba", "Volte à aba original ou importe novamente para começar outra requisição."],
                ["KM/QTD pendente", "Use a conferência correspondente e corrija manualmente se persistir."],
                ["Grid is in dirty state", "Aguarde; a extensão tenta novamente sem avançar o progresso."],
                ["Ajax Error", "A extensão libera o aviso e interrompe. Confira se a operação foi aplicada antes de retomar."],
                ["Sessão expirada ou bloqueio", "Entre novamente e retome somente após conferir tela e progresso."],
            ], [54 * mm, available - 54 * mm], compact=True),
            subheading("Não repita a importação às cegas"),
            paragraph("Itens e QTDs têm progresso separado, vinculado à aba. Antes de reiniciar ou carregar outro arquivo, confira a grade, as pendências e o texto do botão."),
        ],
        [
            heading("10. Conferência final antes de salvar"),
            paragraph("Faça a conferência com planilha e grade lado a lado. O processo só termina quando todos os itens estiverem justificados."),
            *bullets([
                "O número de linhas corresponde ao número de lançamentos do XLSX.",
                "Cada linha possui produto compatível com o combustível.",
                "Cada linha possui a placa correta em Placa (F9) e o centro de custo correto.",
                "KM Atual corresponde ao maior KM da placa ou tem justificativa para ficar sem alteração.",
                "Toda decisão de virada foi tomada conscientemente pelo operador.",
                "Cada QTD corresponde aos litros da mesma linha do XLSX.",
                "Não existem falhas, pendências ou placas não encontradas sem tratamento.",
                "A Requisição de Saída e o período/lote são os corretos.",
            ], marker="□"),
            callout("Somente então salve", "Salvar é uma ação manual do operador. Se houver qualquer dúvida, não salve: registre a pendência e confirme com o responsável."),
            subheading("Registro recomendado"),
            paragraph("Arquivo XLSX: _________________________________________________"),
            paragraph("Data e operador: ______________________________________________"),
            paragraph("Pendências/observações: ________________________________________"),
        ],
        [
            heading("11. Guia rápido de uso diário"),
            callout("Regra principal", "O Fluxo SCPI preenche e confere; o operador decide os casos ambíguos e salva somente após a validação final."),
            subheading("Antes"),
            *bullets([
                "Abrir Requisição de Saída nova, Itens da Saída, grade vazia.",
                "Conferir Placa, KM inteiro seguro, Combustível e Litros positivos.",
                "Confirmar arquivo, período/lote e limite de 500 linhas.",
            ], marker="□"),
            subheading("Executar"),
            *bullets([
                "Selecionar XLSX e conferir o resumo.",
                "Escolher o modo de KM menor; decisões de virada continuam manuais.",
                "Acompanhar Item e QTD sem mudar de aba ou reordenar a grade.",
                "Resolver placa ambígua e avisos diretamente no SCPI.",
            ], marker="□"),
            subheading("Conferir"),
            *bullets([
                "Conferir/corrigir Placas, KM Atual e Quantidades.",
                "Resolver todas as pendências e ler o relatório final.",
                "Salvar manualmente apenas depois da conferência completa.",
            ], marker="□"),
            subheading("Glossário"),
            table([
                ["Termo", "Significado"],
                ["Anterior / Atual", "KM anterior já registrado / KM sendo preparado."],
                ["QTD", "Quantidade de combustível em litros."],
                ["F2 / F3", "Seleção do produto / pesquisa do centro de custo e veículo."],
                ["Placa (F9)", "Coluna que confirma a placa associada ao item."],
            ], [36 * mm, available - 36 * mm], compact=True),
        ],
    ]


def spreadsheet_pages():
    available = PAGE_W - 2 * MARGIN_X
    return [
        [
            heading("1. Estrutura mínima obrigatória"),
            paragraph("Cada linha representa um abastecimento. A extensão procura a primeira aba válida com as quatro colunas obrigatórias na mesma linha."),
            table([
                ["Coluna", "Regra obrigatória", "Exemplo"],
                ["Placa", "7 caracteres após remover hífen e espaços.", "ABC1D23"],
                ["KM", "Inteiro seguro e não negativo; sem milhar ou notação científica.", "43745"],
                ["Combustível", "Texto não vazio contendo Etanol, Diesel ou Gasolina.", "ETANOL HIDRATADO"],
                ["Litros", "Número maior que zero em formato decimal comum.", "20,5"],
            ], [26 * mm, 96 * mm, available - 122 * mm]),
            subheading("Modelo mínimo"),
            table([
                ["Placa", "KM", "Combustível", "Litros"],
                ["ABC1D23", "43745", "ETANOL HIDRATADO", "14"],
                ["XYZ9876", "180320", "DIESEL S-10", "20,5"],
                ["DEF2G45", "98210", "GASOLINA COMUM", "35"],
            ], [35 * mm, 28 * mm, 77 * mm, available - 140 * mm]),
            callout("Limites do arquivo", "Use .xlsx de até 20 MB e no máximo 500 abastecimentos. Arquivos .xls, .csv e .ods não são aceitos."),
        ],
        [
            heading("2. Por que cada coluna precisa desse padrão"),
            subheading("Placa"),
            paragraph("A placa pesquisa o Centro de Custo e confirma Placa (F9). Depois de remover sinais, deve corresponder ao formato antigo ABC1234 ou Mercosul ABC1D23."),
            subheading("KM"),
            paragraph("Deve ser inteiro seguro e não negativo. Digite 43745 em célula numérica. Não use 43.745 como texto, a palavra km, notação científica como 1e5 ou número acima do limite seguro."),
            subheading("Combustível"),
            paragraph("O texto orienta Produto do Pedido e deve conter ETANOL, DIESEL ou GASOLINA. Descrições específicas ajudam a conferência humana."),
            subheading("Litros"),
            paragraph("É a quantidade gravada em QTD. Deve ser maior que zero. Use número simples, como 20 ou 20,5; não use 20 L, preço, total ou 1e3."),
            callout("Valores simples são auditáveis", "Células numéricas e texto direto reduzem ambiguidades. Fórmulas, unidades, células mescladas e anotações dentro dos quatro campos devem ser evitadas."),
        ],
        [
            heading("3. Regras de organização da planilha"),
            table([
                ["Regra", "Permitido", "Evite"],
                ["Cabeçalho", "Uma linha com as quatro colunas.", "Cabeçalhos separados ou células mescladas."],
                ["Linhas", "Uma linha completa por abastecimento.", "Linha parcialmente preenchida."],
                ["Vazias", "Linha com os quatro campos vazios.", "Resíduo em apenas uma coluna."],
                ["Outras colunas", "Podem existir e são ignoradas.", "Substituir uma coluna obrigatória."],
                ["Abas", "Primeira aba completamente válida.", "Cópias antigas antes da aba correta."],
                ["Ordem", "A mesma ordem desejada no SCPI.", "Reordenar depois de importar."],
                ["Valores", "Números simples e texto direto.", "Fórmulas, unidades e células mescladas."],
            ], [31 * mm, 64 * mm, available - 95 * mm], compact=True),
            callout("A planilha inteira é validada", "Qualquer linha relevante inválida bloqueia a importação. Ao selecionar outro arquivo, a sessão de abastecimentos anterior é removida antes da leitura; um novo arquivo inválido não reativa o XLSX antigo."),
            subheading("Privacidade"),
            paragraph("O arquivo é processado localmente pela cópia vendorizada do SheetJS. O conteúdo não é enviado à internet pelo Fluxo SCPI."),
        ],
        [
            heading("4. Regra do maior KM por placa"),
            paragraph("Quando a mesma placa aparece várias vezes, a extensão identifica o maior KM e aplica esse valor a todas as linhas dela."),
            subheading("Exemplo recebido"),
            table([
                ["Linha", "Placa", "KM informado", "Litros"],
                ["2", "ABC1D23", "120", "14"],
                ["3", "XYZ9876", "300", "20,5"],
                ["4", "ABC1D23", "110", "15"],
            ], [26 * mm, 48 * mm, 48 * mm, available - 122 * mm]),
            subheading("Dados preparados para o SCPI"),
            table([
                ["Linha", "Placa", "KM utilizado", "Motivo"],
                ["2", "ABC1D23", "120", "Maior KM da placa."],
                ["3", "XYZ9876", "300", "Único KM da placa."],
                ["4", "ABC1D23", "120", "110 é substituído por 120."],
            ], [22 * mm, 42 * mm, 38 * mm, available - 102 * mm]),
            callout("Atenção", "A regra escolhe o maior valor informado, mas não prova que ele está correto. Revise dígitos trocados, KMs muito altos e placas atribuídas ao veículo errado."),
        ],
        [
            heading("5. Exemplos de erros e correções"),
            table([
                ["Valor problemático", "Problema", "Forma correta"],
                ["Placa AB-123", "Não possui 7 caracteres úteis.", "ABC1234 ou ABC1D23"],
                ["KM 120,5", "KM precisa ser inteiro.", "120"],
                ["KM 43.745 (texto)", "Pode ser interpretado como decimal.", "43745 numérico"],
                ["KM 1e5", "Notação científica não é aceita.", "100000 numérico"],
                ["Combustível S-10", "Não contém DIESEL.", "DIESEL S-10"],
                ["Litros 0 ou 20 L", "Não é número positivo simples.", "14 ou 14,5"],
                ["Litros 1e3", "Notação científica não é aceita.", "1000 numérico"],
                ["501 linhas", "Limite por execução excedido.", "Divida em lotes de até 500"],
            ], [45 * mm, 65 * mm, available - 110 * mm], compact=True),
            subheading("Antes de selecionar"),
            *bullets([
                "Arquivo .xlsx, até 20 MB e no máximo 500 linhas de dados.",
                "Cabeçalho com Placa, KM, Combustível e Litros.",
                "Placas com 7 caracteres úteis; KMs inteiros seguros; litros positivos.",
                "Combustíveis com Etanol, Diesel ou Gasolina.",
                "Maior KM repetido por placa revisado.",
            ], marker="□"),
        ],
        [
            heading("6. Modelo de referência rápida"),
            paragraph("Use cabeçalho na primeira linha, uma aba chamada Abastecimentos e valores simples em células não mescladas."),
            table([
                ["Placa", "KM", "Combustível", "Litros"],
                ["ABC1D23", "43745", "ETANOL HIDRATADO", "14"],
                ["ABC1D23", "43745", "GASOLINA COMUM", "15,5"],
                ["XYZ9876", "180320", "DIESEL S-10", "20"],
            ], [35 * mm, 30 * mm, 75 * mm, available - 140 * mm]),
            subheading("O que acontece depois da seleção"),
            *bullets([
                "A extensão invalida a sessão anterior e procura a primeira aba válida.",
                "Mantém apenas Placa, KM, Combustível e Litros.",
                "Normaliza placas e aplica o maior KM a todas as linhas da mesma placa.",
                "Mostra lançamentos e placas para conferência.",
                "Só então libera a importação e vincula a execução à aba do SCPI usada no início.",
            ]),
            callout("Conferência continua obrigatória", "Um XLSX aceito tem formato válido, mas os dados administrativos ainda precisam ser comparados com os documentos de origem antes de preencher e antes de salvar."),
            subheading("Resumo final"),
            *bullets([
                "Arquivo dentro dos limites; quatro cabeçalhos corretos; uma linha completa por abastecimento.",
                "Placa válida; KM inteiro seguro; combustível reconhecível; litros positivos.",
                "Maior KM por placa e resumo do lote revisados.",
            ], marker="□"),
        ],
    ]


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manual_cover = cover(
        "Processo de Abastecimentos",
        "Como preparar a planilha, preencher a Requisição de Saída e conferir os dados com o Fluxo SCPI",
        "MANUAL DO OPERADOR",
        "Princípio de segurança",
        "O Fluxo SCPI auxilia o preenchimento, mas não salva a Requisição de Saída. Decisões de virada, avisos de KM e o clique em Salvar permanecem com o operador.",
        [("Sistema", "SCPI 9.0"), ("Ferramenta", f"Fluxo SCPI {VERSION}"), ("Público", "Servidores responsáveis por lançamentos de abastecimento"), ("Revisão", REVISION)],
    )
    build_pdf(
        OUTPUT / "Manual_Fluxo_SCPI_Abastecimentos.pdf",
        "Manual Fluxo SCPI - Processo de Abastecimentos",
        "Procedimento operacional para abastecimentos por XLSX no SCPI 9.0",
        "FLUXO SCPI | ABASTECIMENTOS", "Manual do operador",
        manual_cover, manual_pages(),
    )

    spreadsheet_cover = cover(
        "Padrão do XLSX de Abastecimentos",
        "Como montar uma planilha compatível com o Fluxo SCPI e por que cada regra existe",
        "DOCUMENTAÇÃO DE IMPORTAÇÃO",
        "Resumo em uma frase",
        "Use .xlsx com uma linha por abastecimento e as colunas Placa, KM, Combustível e Litros. Valores devem ser simples, completos e auditáveis.",
        [("Aplica-se a", f"Fluxo SCPI {VERSION}"), ("Tipo de arquivo", "Pasta de trabalho do Excel (.xlsx)"), ("Limites", "20 MB e 500 abastecimentos"), ("Uso", "Importação para Requisição de Saída")],
    )
    build_pdf(
        OUTPUT / "Padrao_XLSX_Abastecimentos.pdf",
        "Padrão do XLSX de Abastecimentos - Fluxo SCPI",
        "Padrão de planilha para importação de abastecimentos",
        "FLUXO SCPI | PADRÃO XLSX", "Abastecimentos",
        spreadsheet_cover, spreadsheet_pages(),
    )


if __name__ == "__main__":
    main()
