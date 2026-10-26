"""Ranking dos deputados federais em exercício (legislatura 57, 2023-2027).

Fontes (dados abertos da Câmara dos Deputados):
  https://dadosabertos.camara.leg.br/arquivos/{proposicoes,proposicoesAutores,votacoes,votacoesVotos}/csv/<arquivo>-<ano>.csv
  https://www.camara.leg.br/cotas/Ano-<ano>.csv.zip
  https://dadosabertos.camara.leg.br/api/v2/deputados (lista em exercício)

Uso: python3 ranking_camara.py <pasta_com_os_csv> <saida.json>
"""
import csv, json, sys, os, collections, datetime

csv.field_size_limit(10**9)
D, OUT = sys.argv[1], sys.argv[2]
ANOS = (2023, 2024, 2025, 2026)
TIPOS = {"PL", "PLP", "PEC"}
APROVADOS = {"Transformado em Norma Jurídica", "Aguardando Sanção", "Aguardando Apreciação pelo Senado Federal"}

def ler(nome):
    return csv.DictReader(open(os.path.join(D, nome), encoding="utf-8-sig"), delimiter=";")

deps = {d["id"]: d for d in json.load(open(os.path.join(D, "dep.json")))["dados"]}
ids = {str(i) for i in deps}

# proposições de autoria (primeiro signatário)
tipo, situ = {}, {}
for a in ANOS:
    for r in ler(f"proposicoes-{a}.csv"):
        if r["siglaTipo"] in TIPOS:
            tipo[r["id"]] = r["siglaTipo"]; situ[r["id"]] = r["ultimoStatus_descricaoSituacao"]
apres, aprov, lei = collections.Counter(), collections.Counter(), collections.Counter()
for a in ANOS:
    for r in ler(f"proposicoesAutores-{a}.csv"):
        p, dep = r["idProposicao"], r["idDeputadoAutor"]
        if dep in ids and p in tipo and r["ordemAssinatura"] == "1":
            apres[dep] += 1
            if situ[p] in APROVADOS: aprov[dep] += 1
            if situ[p] == "Transformado em Norma Jurídica": lei[dep] += 1

# presença em votações nominais do plenário
plen = {}
for a in ANOS:
    for r in ler(f"votacoes-{a}.csv"):
        if r["siglaOrgao"] == "PLEN" and int(r["votosSim"] or 0) + int(r["votosNao"] or 0) > 0:
            plen[r["id"]] = r["data"]
datas_plen = sorted(plen.values())
votou = collections.defaultdict(set)
for a in ANOS:
    for r in ler(f"votacoesVotos-{a}.csv"):
        if r["idVotacao"] in plen and r["deputado_id"] in ids:
            votou[r["deputado_id"]].add(r["idVotacao"])
# períodos em exercício do mandato (exclui licenças para cargo no Executivo, saúde etc.)
def periodos(dep):
    h = json.load(open(os.path.join(D, "hist", f"{dep}.json")))["dados"]
    ev = sorted((x["dataHora"][:10], x["situacao"]) for x in h if x["idLegislatura"] == 57 and x["situacao"])
    out, ini = [], None
    for data, sit in ev:
        if sit == "Exercício":
            ini = ini or data
        elif ini:
            out.append((ini, data)); ini = None
    if ini: out.append((ini, "2099-12-31"))
    return out
# o presidente da Câmara não vota (Regimento Interno, art. 17): período excluído da presença
PRESIDENCIA = {"Arthur Lira": ("2023-02-01", "2025-01-31"), "Hugo Motta": ("2025-02-01", "2027-01-31")}
exercicio = {}
for dep in ids:
    per = periodos(dep)
    nome = deps[int(dep)]["nome"]
    if nome in PRESIDENCIA:
        a, b = PRESIDENCIA[nome]
        novo = []
        for i, f in per:
            if i < a: novo.append((i, min(f, a)))
            if f > b: novo.append((max(i, b), f))
        per = novo
    exercicio[dep] = per
def em_exercicio(dep, data):
    return any(i <= data < f for i, f in exercicio[dep])
pres = {}
for dep in ids:
    total = [v for v, d in plen.items() if em_exercicio(dep, d)]
    feitos = sum(1 for v in total if v in votou[dep])
    pres[dep] = (feitos, len(total))

# cota parlamentar (CEAP): gasto médio por mês em exercício
gasto = collections.defaultdict(float)
for a in ANOS:
    for r in csv.DictReader(open(os.path.join(D, f"Ano-{a}.csv"), encoding="utf-8-sig"), delimiter=";"):
        if r["ideCadastro"] in ids:
            gasto[r["ideCadastro"]] += float(r["vlrLiquido"] or 0)
hoje = max(datas_plen)
def meses_exercicio(dep):
    dias = 0
    for i, f in periodos(dep):
        a, b = datetime.date.fromisoformat(i), datetime.date.fromisoformat(min(f, hoje))
        dias += max(0, (b - a).days)
    return max(1, dias / 30.44)
cota = {dep: gasto[dep] / meses_exercicio(dep) for dep in ids}

def pct(valores):
    """percentil (0-100) por posição, com empates na média"""
    itens = sorted(valores.items(), key=lambda kv: kv[1])
    n, out, i = len(itens), {}, 0
    while i < n:
        j = i
        while j + 1 < n and itens[j + 1][1] == itens[i][1]: j += 1
        p = 100 * ((i + j) / 2) / (n - 1) if n > 1 else 50
        for k in range(i, j + 1): out[itens[k][0]] = p
        i = j + 1
    return out

base = [d for d in ids if d in pres and pres[d][1] >= 20]
p_apres = pct({d: apres[d] for d in base})
p_aprov = pct({d: aprov[d] for d in base})
p_pres = pct({d: pres[d][0] / pres[d][1] for d in base})
# economia da cota: comparação só com colegas do mesmo estado (o teto varia por UF)
p_cota = {}
for uf in {deps[int(d)]["siglaUf"] for d in base}:
    grupo = [d for d in base if deps[int(d)]["siglaUf"] == uf]
    for d, v in pct({d: -cota[d] for d in grupo}).items(): p_cota[d] = v

PESOS = {"aprovados": 0.30, "presenca": 0.30, "apresentados": 0.20, "cota": 0.20}
lista = []
for d in base:
    dep = deps[int(d)]
    comp = {"apresentados": p_apres[d], "aprovados": p_aprov[d], "presenca": p_pres[d], "cota": p_cota[d]}
    nota = sum(PESOS[k] * comp[k] for k in PESOS)
    lista.append({
        "id": int(d), "nome": dep["nome"], "partido": dep["siglaPartido"], "uf": dep["siglaUf"],
        "foto": dep["urlFoto"],
        "apresentados": apres[d], "aprovados": aprov[d], "leis": lei[d],
        "presenca": round(100 * pres[d][0] / pres[d][1], 1), "votacoes": pres[d][1],
        "cota_mes": round(cota[d]), "aval_popular": None,
        "comp": {k: round(v, 1) for k, v in comp.items()}, "nota": round(nota, 1),
    })
lista.sort(key=lambda x: -x["nota"])
for i, x in enumerate(lista, 1): x["pos"] = i
json.dump({"casa": "camara", "legislatura": "2023-2027", "pesos": PESOS,
           "periodo": [datas_plen[0], datas_plen[-1]], "n_votacoes": len(plen),
           "parlamentares": lista}, open(OUT, "w"), ensure_ascii=False, indent=0)
print(len(lista), "deputados; votações nominais no plenário:", len(plen), datas_plen[0], datas_plen[-1])
print([(x["pos"], x["nome"], x["partido"], x["nota"]) for x in lista[:5]])
print([(x["pos"], x["nome"], x["partido"], x["nota"]) for x in lista[-3:]])
