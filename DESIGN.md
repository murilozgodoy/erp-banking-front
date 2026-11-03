# DESIGN — ErpIa

Fonte da marca: `../brand/BRAND.md`. Tokens em `src/index.css` (variáveis `--erpia-*`, expostas como utilitários
Tailwind: `bg-paper`, `bg-surface`, `bg-sunken`, `border-line`, `text-ink`, `text-ink-muted`, `bg-accent`,
`bg-credit`, `text-credit-ink`, `text-positive`...). Não use a paleta padrão do Tailwind (slate, indigo...).

## Mundo

Base grafite com subtom verde, **esmeralda** para ação, seleção e foco, **lima** para IA e crédito. Claro por padrão
(escritório, horário comercial); escuro pelo sistema ou pela escolha salva (`localStorage['erpia-theme']`,
aplicada no `index.html` antes do primeiro paint).

## Tipografia

Instrument Sans Variable, uma família só. Escala fixa em rem, razão ~1,2 (`text-2xs` 11 px até `text-4xl` 41 px).
Títulos 600, corpo 400, valores 500/600. Todo número em `.tabular` (tnum). Valores em BRL pelo componente `Money`
(centavos um degrau menores).

## Elemento-assinatura: Faísca

A estrela lima de 4 pontas do símbolo (`<Faisca/>`, `src/components/brand/Logo.tsx`). Marca **só** o que a ErpIa
infere: insights, oportunidades de crédito e valores pré-aprovados. Pequena, ao lado do título do bloco. No portal,
o bloco **insight + oferta de crédito** de cada aba carrega a Faísca; a oferta usa o fundo `credit-soft` e o texto
`credit-ink` (lima nunca é texto sobre fundo claro).

## Layout

Portal: rail lateral grafite (`bg-rail`) + área de trabalho em `bg-paper`, painéis `bg-surface` com
`border-line` e `shadow-raised`, raio de 12 px (`rounded-panel`) e 7 px nos controles (`rounded-control`).
Indicadores em faixa densa com divisores, não em cards iguais. Sem card dentro de card.

## Motion

150 a 250 ms, ease-out exponencial (`--ease-out-expo`), só para estado: entrada de painéis laterais, troca de
seleção, confirmação. Nada de coreografia no carregamento. Respeita `prefers-reduced-motion`.

## Estados

Todo componente tem hover, foco visível (anel esmeralda), ativo, desabilitado, carregando (skeleton, não spinner no
meio do conteúdo), erro (problema + como resolver + "Tentar de novo") e vazio que ensina.

## Gráficos

Séries 1 a 5 dos tokens, em ordem fixa. Um eixo só, grade recessiva, tooltip no hover, legenda com 2+ séries e
tabela acessível equivalente.

## Não fazer

Eyebrow acima de título, gradiente, texto em lima sobre fundo claro, Faísca decorativa, glass/blur decorativo,
borda lateral colorida > 1 px, sombra dura, emoji como ícone, numeração 01/02/03.
