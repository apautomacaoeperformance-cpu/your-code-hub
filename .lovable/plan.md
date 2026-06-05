# Tradução completa do sistema (PT / EN / ES)

## Escopo

São ~25 telas, vários componentes e diálogos. Cada uma contém dezenas de textos: títulos, labels de formulário, colunas de tabela, botões, mensagens de toast, validações, placeholders, status, modais de confirmação e textos de PDFs.

Estimativa: ~800–1.200 chaves de tradução novas.

## Abordagem

Trabalhar em **fases**, módulo por módulo. Cada fase entrega telas funcionais nos 3 idiomas antes de seguir.

### Estrutura de chaves

Organizar `src/i18n/locales/{pt,en,es}.ts` por módulo:

```text
common: { save, cancel, edit, delete, search, loading, ... }
fields: { name, cpf, cnpj, email, phone, value, date, status, ... }
status: { active, inactive, pending, paid, overdue, ... }
toasts: { saved, deleted, error, ... }
dashboard: { ... }
debentures: { list, detail, form, ... }
debenturistas: { ... }
... (um namespace por tela)
```

### Fases

1. **Base compartilhada** — `common`, `fields`, `status`, `toasts`, validações de formulário. Aplicar em todos os componentes reutilizáveis (botões padrão, confirmações, mensagens).
2. **Dashboard + Visão Geral + Projeção Caixa + Investimentos** — telas principais.
3. **Operações** — Debêntures (lista + detalhe + form), Pagamentos, Vencimentos, Vendas, Antecipações, Contratos, Recompra, Informe Rendimento, Avaliações Risco.
4. **Clientes** — Debenturistas (lista + form), CedentesPF.
5. **Cadastros** — Operações, Sacados, Cedentes, Usuários.
6. **Financeiro** — Caixas, Movimentações.
7. **Administração** — Calculadora, Cessionária, ConfiguraçãoBoleto, Despesas, Fornecedores, Parâmetros, Permissões.
8. **PDFs e relatórios** — `src/lib/pdf.ts` e geradores em `Debenturistas.tsx`, `DebentureDetalhe.tsx`, `InformeRendimento.tsx` (textos fixos dos PDFs respeitam o idioma atual).
9. **Edge functions** (informes e rendimentos) — opcional: passar `lang` como parâmetro se desejado.

## Detalhes técnicos

- Manter `pt` como fallback (`fallbackLng: 'pt'`).
- Datas: usar `i18n.language` para escolher locale do `toLocaleDateString` (`pt-BR`, `en-US`, `es-ES`). Criar helper `formatDate(date)` em `src/lib/utils.ts`.
- Moeda: manter `BRL` (sistema é brasileiro), mas formatação numérica seguir locale.
- Toasts: substituir strings literais por `t('toasts.xxx')`.
- Schemas Zod: mensagens via `t()` em função (não no top-level do módulo).
- Status enums do banco continuam em PT no DB; tradução apenas na exibição via mapa `t('status.' + value)`.
- Não traduzir: nomes próprios (marca, razão social), valores de banco de dados, identificadores.

## Entregáveis por fase

Cada fase: telas afetadas + chaves novas nos 3 locales + verificação visual no preview.

## Confirmação

Confirma seguir nessa ordem? Posso começar pela **Fase 1 + Fase 2** (base + dashboards) nesta resposta e prosseguir nas próximas mensagens, ou prefere outra ordem/prioridade?
