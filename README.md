# PostForge — sua máquina de posts no seu tom de voz

Um sistema local, sem build e sem servidor, inspirado na dinâmica do **Ravia PostCreator**: em vez de gerar posts genéricos, ele constrói um **Manual da Marca** (o "cérebro") e faz todo post nascer dele — alinhado ao seu cliente ideal, diferenciais, **tom de voz**, cores e assuntos.

## Como funciona (a dinâmica, igual à do Ravia)

1. **Manual da Marca** — o núcleo. Você preenche na mão **ou** cola de 3 a 10 textos que *você mesmo* escreveu e a IA faz a engenharia reversa do seu perfil (cliente ideal, diferenciais, tom de voz, pilares, paleta e fontes). É o equivalente ao "raio-x do Instagram" do Ravia, feito com o seu material.
2. **Gerar posts** — você dá um tema (ou pede **ideias**), escolhe formato (imagem única, frase de impacto, checklist, carrossel) e objetivo. A IA escreve **título de capa**, **legenda no seu tom**, **hashtags** e o **"Por que esse post?"** (a estratégia).
3. **Estúdio** — escolha entre **6 variações de template**, edite texto, cores, fonte, foto e posição, **gere a foto de fundo por IA** e **exporte em PNG 1080×1350**. Copie a legenda pronta.
4. **Calendário** — planeje um lote de posts (ex.: 30 dias) distribuídos por pilar/formato/ângulo, com status editável. **Gere cada post com 1 clique** e **exporte o plano em CSV ou .ics** (agenda).
5. **Biblioteca** — salva seus posts (no navegador) para reabrir e reeditar.

## Imagem de fundo por IA

No Estúdio, aba **Foto → Gerar imagem com IA**:
- **Sugerir**: a Claude cria um prompt de imagem a partir do post + seu estilo visual.
- **Gerar imagem**: cria o fundo. Dois provedores (em ⚙ Config):
  - **Pollinations** — grátis, sem chave (padrão).
  - **OpenAI (gpt-image-1)** — mais qualidade, exige chave OpenAI.
- A imagem vem como `data:` URL, então o **export em PNG funciona sem problema de CORS**.

## Rodando

**Opção A — abrir direto:** dê duplo-clique em `index.html` (ou arraste para o navegador).

**Opção B — servidor local (recomendado, evita bloqueios do `file://`):**
```bash
cd Social-Media
python3 -m http.server 8000
# abra http://localhost:8000
```

## Ligando a IA (Claude)

- Clique em **⚙ Config** e cole sua **chave da API da Anthropic** (`sk-ant-...`), pegue em https://console.anthropic.com.
- A chave fica **só no seu navegador** (`localStorage`) e é enviada apenas para `api.anthropic.com`.
- Modelos: Sonnet 5 (padrão), Opus 5 (mais criativo), Haiku 4.5 (mais barato).
- **Sem chave:** o app funciona em **modo offline** com um gerador simples baseado em regras (menos criativo). Para textos realmente no seu tom, use a Claude API.

## Fotos e export

- **Enviar foto** (upload) é o caminho mais seguro para o export em PNG.
- Fotos por **URL/busca** podem falhar no export por regras de CORS do site de origem — nesse caso, baixe a imagem e use "Enviar foto".
- Sem foto, use **fundo em degradê** ou os templates de **fundo sólido**.

## Estrutura

```
index.html          # UI (4 abas: Manual, Gerar, Estúdio, Biblioteca)
css/app.css
js/store.js         # estado + localStorage (manual, config, biblioteca, calendário)
js/prompts.js       # prompts (inteligência de marca → posts, imagem, plano)
js/ai.js            # cliente Claude API + fallback offline + parser JSON
js/image.js         # geração de imagem de fundo (Pollinations / OpenAI)
js/templates.js     # 6 templates visuais (render do card 1080×1350)
js/studio.js        # edição, variações, zoom, imagem por IA, export PNG
js/calendar.js      # calendário de conteúdo + export CSV/ICS
js/app.js           # orquestração (abas, gerar, biblioteca, config)
vendor/             # html2canvas (local, para export sem CDN)
```

## Privacidade

Tudo roda no seu navegador. Nada é enviado a servidores além das chamadas que **você** faz à API da Anthropic quando a chave está configurada.
