"""Atualiza brasil-2026/indicadores.json com as séries do Banco Central (SGS).

Séries (mesmas da série histórica da página):
  ipca  13522  IPCA acumulado em 12 meses (%)
  selic 4189   Selic efetiva anualizada, média do mês (%)
  meta  432    Meta da Selic definida pelo Copom (% a.a.)
  div   13762  Dívida bruta do governo geral (% do PIB)
  des   24369  Taxa de desocupação, PNAD Contínua, trimestre móvel (%)
  pib   7326   Crescimento real do PIB no ano (%)
Séries do Ipeadata (www.ipeadata.gov.br):
  cesta  Custo da cesta básica em São Paulo (DIEESE, CESBTOTAL, convertido para R$)
         dividido pelo salário mínimo vigente (MTE12_SALMIN12): % do salário mínimo
  gas    Preço médio anual da gasolina ao consumidor (ANP, ANP_PRGASOL), a partir de 1995,
         em reais do último mês do IPCA (deflator: IPCA, SGS 433)
Projeções: Boletim Focus do Banco Central (API Olinda, ExpectativasMercadoAnuais), mediana do ano corrente e do seguinte.

Uso: python3 indicadores.py <saida.json>
"""
import json, sys, urllib.request, datetime, time

SERIES = {"ipca": 13522, "selic": 4189, "meta": 432, "div": 13762, "des": 24369, "pib": 7326}
ANUAL = {"pib"}

def sgs(cod, inicio="01/01/1985"):
    url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados/ultimos/1?formato=json" if inicio is None
           else f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial={inicio}")
    for t in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=120))
        except Exception as e:
            erro = e; time.sleep(5 * (t + 1))
    raise erro

out = {"atualizado": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).isoformat(timespec="seconds"),
       "fonte": "Banco Central do Brasil, SGS", "series": {}, "ultimo": {}}
for k, cod in SERIES.items():
    dados = sgs(cod, None if k == "meta" else "01/01/1985")
    if not isinstance(dados, list): raise SystemExit(f"{k}: resposta inesperada {dados}")
    pts = []
    for r in dados:
        d, m, a = (int(x) for x in r["data"].split("/"))
        v = round(float(r["valor"]), 2)
        pts.append([a if k in ANUAL else a * 12 + m - 1, v])
    if k == "meta":  # meta diária: guarda só o último valor
        out["ultimo"][k] = {"valor": pts[-1][1], "data": dados[-1]["data"]}
        continue
    out["series"][k] = pts
    out["ultimo"][k] = {"valor": pts[-1][1], "data": dados[-1]["data"]}

def ipea(cod):
    url = f"http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{cod}')"
    for _ in range(3):
        try:
            return [x for x in json.load(urllib.request.urlopen(url, timeout=180))["value"] if x["VALVALOR"] is not None]
        except Exception as e:
            erro = e
    raise erro

# cesta básica (São Paulo) como % do salário mínimo
mes = lambda d: int(d[:4]) * 12 + int(d[5:7]) - 1
sm = {mes(x["VALDATA"]): x["VALVALOR"] for x in ipea("MTE12_SALMIN12")}
cesta = sorted((mes(x["VALDATA"]), x["VALVALOR"]) for x in ipea("CESBTOTAL") if x.get("TERCODIGO") == "3550308" and x["VALDATA"] >= "1985")
out["series"]["cesta"] = [[m, round(100 * v / sm[m], 1)] for m, v in cesta if m in sm]
m, v = cesta[-1]
out["ultimo"]["cesta"] = {"valor": round(v, 2), "pct_sm": out["series"]["cesta"][-1][1], "data": f"01/{m % 12 + 1:02d}/{m // 12}"}

# gasolina: preço real (IPCA) a partir do Plano Real
idx, nivel = {}, 1.0
for r in sgs(433, "01/01/1994"):
    d, mm, a = (int(x) for x in r["data"].split("/"))
    nivel *= 1 + float(r["valor"]) / 100
    idx[a * 12 + mm - 1] = nivel
ult = max(idx)
media_ano = {a: sum(v for k, v in idx.items() if k // 12 == a) / sum(1 for k in idx if k // 12 == a) for a in {k // 12 for k in idx}}
gas = [(int(x["VALDATA"][:4]), x["VALVALOR"] / 1000) for x in ipea("ANP_PRGASOL") if int(x["VALDATA"][:4]) >= 1995]
out["series"]["gas"] = [[a, round(v * idx[ult] / media_ano[a], 2)] for a, v in gas if a in media_ano]
out["ultimo"]["gas"] = {"valor": round(gas[-1][1], 2), "ano": gas[-1][0], "real_ref": f"{ult % 12 + 1:02d}/{ult // 12}"}

# projeções de mercado: Boletim Focus (Banco Central), mediana mais recente
FOCUS = {"ipca": ("IPCA", None), "selic": ("Selic", None), "pib": ("PIB Total", None), "div": ("Dívida bruta do governo geral", None),
         "des": ("Taxa de desocupação", None), "cesta": ("IPCA Alimentação no domicílio", None), "cambio": ("Câmbio", None)}
ano = datetime.date.today().year
url = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$format=json&$top=2000"
       f"&$orderby=Data%20desc&$filter=Data%20ge%20'{(datetime.date.today() - datetime.timedelta(days=21)).isoformat()}'")
fx = None
for t in range(5):
    try:
        fx = json.load(urllib.request.urlopen(url, timeout=120))["value"]; break
    except Exception:
        time.sleep(5 * (t + 1))
if fx:
    data = max(x["Data"] for x in fx)
    out["projecoes"] = {"fonte": "Banco Central, Boletim Focus (mediana)", "data": data, "itens": {}}
    for k, (ind, _) in FOCUS.items():
        anos = {}
        for x in fx:
            if x["Data"] == data and x["Indicador"] == ind and x.get("baseCalculo") == 0 and x["DataReferencia"] in (str(ano), str(ano + 1)):
                anos[x["DataReferencia"]] = round(x["Mediana"], 2)
        if anos:
            out["projecoes"]["itens"][k] = anos

json.dump(out, open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))
print({k: v for k, v in out["ultimo"].items()})
