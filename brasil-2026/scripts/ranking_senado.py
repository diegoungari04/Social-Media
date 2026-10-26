"""Ranking dos senadores em exercício (legislatura 57, 2023-2027).

Fontes (dados abertos do Senado Federal):
  https://legis.senado.leg.br/dadosabertos/senador/lista/atual
  https://legis.senado.leg.br/dadosabertos/processo?codigoParlamentarAutor=<cod>&dataInicioApresentacao=2023-02-01
  https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=<ini>&dataFim=<fim>
  https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_<ano>.csv

Uso: python3 ranking_senado.py <pasta_com_os_arquivos> <saida.json>
"""
import csv, json, sys, os, collections, unicodedata

D, OUT = sys.argv[1], sys.argv[2]
ANOS = (2023, 2024, 2025, 2026)
TIPOS = {"PL", "PLP", "PEC"}
PRESENTE = {"Sim", "Não", "Abstenção", "Votou", "P-NRV", "Obstrução", "Presidente (art. 51 RISF)"}
LICENCA = {"LS", "LP", "NA"}  # licença saúde/particular e "não aplicável": fora do denominador

def norm(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper().strip()

sen = {}
for p in json.load(open(os.path.join(D, "atual.json")))["ListaParlamentarEmExercicio"]["Parlamentares"]["Parlamentar"]:
    i = p["IdentificacaoParlamentar"]
    sen[int(i["CodigoParlamentar"])] = {"nome": i["NomeParlamentar"], "partido": i["SiglaPartidoParlamentar"],
                                        "uf": i["UfParlamentar"], "foto": i["UrlFotoParlamentar"]}

apres, aprov, lei = collections.Counter(), collections.Counter(), collections.Counter()
for cod, s in sen.items():
    for x in json.load(open(os.path.join(D, "proc", f"{cod}.json"))):
        if x["identificacao"].split()[0] not in TIPOS: continue
        primeiro = x.get("autoria", "").split(",")[0]
        if norm(s["nome"]) not in norm(primeiro): continue
        apres[cod] += 1
        delib, sit = x.get("siglaTipoDeliberacao") or "", x.get("situacaoAtual") or ""
        if delib.startswith("APROVADA") or "TRANSFORMADA" in sit: aprov[cod] += 1
        if "TRANSFORMADA" in sit: lei[cod] += 1

feitos, total, meses = collections.Counter(), collections.Counter(), collections.defaultdict(set)
n_vot, datas = 0, []
for a in ANOS:
    for v in json.load(open(os.path.join(D, f"vot-{a}.json"))):
        n_vot += 1; datas.append(v["dataSessao"])
        for x in v["votos"]:
            cod = x["codigoParlamentar"]
            if cod not in sen or x["siglaVotoParlamentar"] in LICENCA: continue
            total[cod] += 1; meses[cod].add(v["dataSessao"][:7])
            if x["siglaVotoParlamentar"] in PRESENTE: feitos[cod] += 1

gasto = collections.defaultdict(float)
por_nome = {norm(s["nome"]): cod for cod, s in sen.items()}
for a in ANOS:
    linhas = open(os.path.join(D, f"ceaps-{a}.csv"), encoding="latin-1").read().splitlines()[1:]
    for r in csv.DictReader(linhas, delimiter=";"):
        nome = norm(r["SENADOR"])
        cod = por_nome.get(nome) or next((c for n, c in por_nome.items() if nome.startswith(n + " ")), None)
        if cod and f'{r["ANO"]}-{int(r["MES"]):02d}' in meses[cod]:
            gasto[cod] += float(r["VALOR_REEMBOLSADO"].replace(".", "").replace(",", ".") or 0)
cota = {c: gasto[c] / max(1, len(meses[c])) for c in sen}

def pct(valores):
    itens = sorted(valores.items(), key=lambda kv: kv[1])
    n, out, i = len(itens), {}, 0
    while i < n:
        j = i
        while j + 1 < n and itens[j + 1][1] == itens[i][1]: j += 1
        p = 100 * ((i + j) / 2) / (n - 1) if n > 1 else 50
        for k in range(i, j + 1): out[itens[k][0]] = p
        i = j + 1
    return out

base = [c for c in sen if total[c] >= 20]
p_apres = pct({c: apres[c] for c in base})
p_aprov = pct({c: aprov[c] for c in base})
p_pres = pct({c: feitos[c] / total[c] for c in base})
# a cota varia por estado: cada senador é comparado à média de gasto mensal dos senadores do mesmo estado
media_uf = {uf: sum(cota[c] for c in base if sen[c]["uf"] == uf) / max(1, sum(1 for c in base if sen[c]["uf"] == uf)) for uf in {s["uf"] for s in sen.values()}}
p_cota = pct({c: -(cota[c] / media_uf[sen[c]["uf"]] if media_uf[sen[c]["uf"]] else 1) for c in base})

PESOS = {"aprovados": 0.30, "presenca": 0.30, "apresentados": 0.20, "cota": 0.20}
lista = []
for c in base:
    s = sen[c]
    comp = {"apresentados": p_apres[c], "aprovados": p_aprov[c], "presenca": p_pres[c], "cota": p_cota[c]}
    lista.append({"id": c, "nome": s["nome"], "partido": s["partido"], "uf": s["uf"], "foto": s["foto"],
                  "apresentados": apres[c], "aprovados": aprov[c], "leis": lei[c],
                  "presenca": round(100 * feitos[c] / total[c], 1), "votacoes": total[c],
                  "cota_mes": round(cota[c]), "aval_popular": None,
                  "comp": {k: round(v, 1) for k, v in comp.items()},
                  "nota": round(sum(PESOS[k] * comp[k] for k in PESOS), 1)})
lista.sort(key=lambda x: -x["nota"])
for i, x in enumerate(lista, 1): x["pos"] = i
datas.sort()
json.dump({"casa": "senado", "legislatura": "2023-2027", "pesos": PESOS, "periodo": [datas[0], datas[-1]],
           "n_votacoes": n_vot, "parlamentares": lista}, open(OUT, "w"), ensure_ascii=False, indent=0)
print(len(lista), "senadores; votações nominais:", n_vot, datas[0], datas[-1])
print("sem nenhum reembolso na cota:", [sen[c]["nome"] for c in base if gasto[c] == 0])
print([(x["pos"], x["nome"], x["partido"], x["nota"]) for x in lista[:5]])
print([(x["pos"], x["nome"], x["partido"], x["nota"]) for x in lista[-3:]])
