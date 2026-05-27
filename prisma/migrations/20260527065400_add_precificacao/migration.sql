-- CreateTable
CREATE TABLE "Precificacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "descricao" TEXT,
    "clienteId" TEXT,
    "observacoes" TEXT,
    "tempoProducao" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorHora" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxaMarketplace" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartao" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "impostos" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxasAdicionais" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "margemLucro" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "custoMateriais" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "custoMaoDeObra" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCustosFixos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalExtras" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTaxas" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lucroValor" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "precoFinal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "precoUnitario" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Precificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPrecificacao" (
    "id" TEXT NOT NULL,
    "precificacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "custoUnitario" DECIMAL(10,2) NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MaterialPrecificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustoFixoPrecificacao" (
    "id" TEXT NOT NULL,
    "precificacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CustoFixoPrecificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraPrecificacao" (
    "id" TEXT NOT NULL,
    "precificacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ExtraPrecificacao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Precificacao" ADD CONSTRAINT "Precificacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrecificacao" ADD CONSTRAINT "MaterialPrecificacao_precificacaoId_fkey" FOREIGN KEY ("precificacaoId") REFERENCES "Precificacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustoFixoPrecificacao" ADD CONSTRAINT "CustoFixoPrecificacao_precificacaoId_fkey" FOREIGN KEY ("precificacaoId") REFERENCES "Precificacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraPrecificacao" ADD CONSTRAINT "ExtraPrecificacao_precificacaoId_fkey" FOREIGN KEY ("precificacaoId") REFERENCES "Precificacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
