---
type: concept
tags: [negocio, produtos]
---

# Fórmulas de Precificação

Cálculo de preço sugerido para produtos. A **configuração** fica na API; o **cálculo** é feito no frontend.

## Parâmetros (config por usuário)

- **Mão de obra:** salário mensal, horas/semana, semanas/mês
- **Custos fixos:** lista dinâmica (nome + valor mensal)
- **Rateio:** dias trabalhados/mês, horas/dia
- **Taxas %:** marketplace, cartão, impostos, adicionais
- **Por produto:** tempo de produção (minutos), margem de lucro (%), BOM (materiais)

## Fórmulas

```
Mão de obra/peça = (salário / (horasSemanais × semanasMes)) × (tempoProducao / 60)

Custo fixo/peça = (Σ custosFixos / (diasTrabalhados × horasDia)) × (tempoProducao / 60)

Subtotal = materiais + mão de obra + custo fixo

Custo com taxas = subtotal / (1 - Σtaxas%/100)

Preço sugerido = custoComTaxas / (1 - margemLucro%/100)
```

## Regras de negócio

- Margem de lucro: slider 0–80% na UI
- Botão "Usar preço sugerido" arredonda para 2 casas
- Custo de materiais = `precoCusto × quantidade` por item do BOM

## Regras técnicas

- API: `GET/PUT /precificacao` — armazena config, sem cálculo
- UI: lógica em `lib/precificacao.ts` (`calcularPrecoProduto`) e duplicada inline nas pages de produto
- Update de config substitui integralmente lista de `custosFixos`

## Relacionado

- [[produto]]
- [[materia-prima]]
- [[features/precificacao]]
- [[features/produtos]]
