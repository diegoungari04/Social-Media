"""Atualiza brasil-2026/indicadores.json com as séries do Banco Central (SGS).

Séries (mesmas da série histórica da página):
  ipca  13522  IPCA acumulado em 12 meses (%)
  selic 4189   Selic efetiva anualizada, média do mês (%)
  meta  432    Meta da Selic definida pelo Copom (% a.a.)
  div   13762  Dívida bruta do governo geral (% do PIB)
  des   24369  Taxa de desocupação, PNAD Contínua, trimestre móvel (%)
  pib   7326   Crescimento real do PIB no ano (%)

Uso: python3 indicadores.py <saida.json>
"""
import json, sys, urllib.request, datetime

SERIES = {"ipca": 13522, "selic": 4189, "meta": 432, "div": 13762, "des": 24369, "pib": 7326}
ANUAL = {"pib"}

def sgs(cod, inicio="01/01/1985"):
    url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados/ultimos/1?formato=json" if inicio is None
           else f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial={inicio}")
    for _ in range(3):
        try:
            return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception as e:
            erro = e
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
json.dump(out, open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))
print({k: v for k, v in out["ultimo"].items()})
