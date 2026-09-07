/* prompts.js — construção dos prompts enviados ao Claude.
   Toda a "inteligência de marca" mora aqui. */
window.Prompts = (function () {

  function manualToBrief(m) {
    const list = (a) => (a && a.length ? a.map((x) => "- " + x).join("\n") : "- (não informado)");
    return `MANUAL DA MARCA (use como fonte da verdade em tudo):
Marca/perfil: ${m.brand || "(sem nome)"}
Nicho: ${m.niche || "(não informado)"}

Cliente ideal:
${m.client || "(não informado)"}

Diferenciais:
${list(m.differentials)}

Tom de voz (adjetivos): ${m.tone && m.tone.length ? m.tone.join(", ") : "(não informado)"}
Voz/pessoa: ${m.person}
Uso de emojis: ${m.emoji}

Pilares de conteúdo:
${list(m.topics)}

Frases/bordões típicos do autor (imite o ritmo, não copie literalmente):
${list(m.phrases)}

CTA preferido: ${m.cta || "(livre)"}
Hashtags base: ${(m.hashtags || []).join(" ") || "(nenhuma)"}`;
  }

  // ---------- 1) Extrair Manual da Marca a partir de textos do usuário ----------
  function analyzeSystem() {
    return `Você é um estrategista de branding e copywriting brasileiro. Recebe textos escritos pela própria pessoa (posts, legendas, bio) e faz a engenharia reversa da marca dela: cliente ideal, diferenciais, tom de voz, pilares de conteúdo e identidade visual sugerida.
Responda SOMENTE com um objeto JSON válido (sem markdown, sem comentários) no formato:
{
  "brand": string,
  "niche": string,
  "client": string,
  "differentials": string[],
  "tone": string[],
  "person": "Fala como 'a gente' / nós, incluindo o leitor" | "Fala em primeira pessoa (eu)" | "Fala direto com 'você'",
  "emoji": "nenhum" | "poucos e pontuais" | "moderado" | "muitos",
  "topics": string[],
  "phrases": string[],
  "hashtags": string[],
  "cta": string,
  "colors": { "accent": string(hex), "dark": string(hex), "light": string(hex), "ontext": string(hex) },
  "fonts": { "head": string, "body": string }
}
Regras: escreva em português do Brasil. "phrases" = 2 a 4 bordões/construções recorrentes que capturam o jeito da pessoa escrever. "tone" = 4 a 6 adjetivos. Cores devem formar uma paleta harmônica coerente com o assunto. "fonts.head" escolha entre: Playfair Display, DM Serif Display, Lora, Poppins, Bebas Neue. "fonts.body" entre: Inter, Poppins, Lora.`;
  }
  function analyzeUser(text, niche) {
    return `${niche ? "Nicho declarado: " + niche + "\n\n" : ""}Textos escritos pela pessoa:\n"""\n${text}\n"""\n\nFaça o Manual da Marca em JSON.`;
  }

  // ---------- 2) Gerar posts ----------
  const FORMAT_HINTS = {
    "imagem-unica":
      'Formato "imagem-unica": um título curto e forte + um subtítulo de 1-2 frases que aparece sobre a foto. items = [].',
    quote:
      'Formato "quote": uma frase de impacto (headline) memorável e um subtítulo curto que a sustenta. items = [].',
    checklist:
      'Formato "checklist": um título de lista (ex.: "5 sinais de...") + 4 a 6 itens curtos (3-5 palavras cada) no campo items. subheadline curto ou "".',
    carrossel:
      'Formato "carrossel": um título de capa + de 4 a 6 telas em items, cada item é o texto principal de uma tela (frases curtas, uma ideia por tela).',
  };

  function generateSystem() {
    return `Você é um redator publicitário e social media brasileiro de altíssimo nível. Escreve posts de Instagram que soam exatamente como a pessoa dona da marca — nunca genéricos, nunca "de coach". Você domina ganchos, quebra de padrão, storytelling curto e CTAs naturais.
Responda SOMENTE com JSON válido (sem markdown). Formato:
{
  "posts": [
    {
      "format": string,               // igual ao formato pedido
      "headline": string,             // texto grande da capa (curto, impactante)
      "highlight": string,            // trecho EXATO de headline que deve ganhar destaque colorido ("" se nenhum)
      "subheadline": string,          // frase de apoio na imagem
      "items": string[],              // itens (checklist/carrossel) ou []
      "caption": string,              // legenda completa, no tom da marca, com quebras de linha (\\n)
      "hashtags": string[],           // 4 a 8 hashtags relevantes
      "rationale": string             // "Por que esse post?": 1-2 frases de estratégia
    }
  ]
}
Regras rígidas:
- Português do Brasil, respeitando voz/pessoa, emojis e bordões do Manual.
- headline no máximo ~8 palavras. "highlight" DEVE ser uma substring literal de headline.
- A legenda deve abrir com um gancho forte na 1ª linha, desenvolver com a lógica da marca e terminar com CTA coerente com o Manual.
- Nada de clichê motivacional vazio. Seja específico e humano.`;
  }

  function generateUser(m, { topic, format, objective, count }) {
    return `${manualToBrief(m)}

TAREFA: gere ${count} post(s) diferentes entre si sobre o tema:
"${topic}"

Formato de cada post: ${format}. ${FORMAT_HINTS[format] || ""}
Objetivo de comunicação: ${objective}.

Cada post deve explorar um ângulo distinto do tema. Retorne o JSON com "posts".`;
  }

  // ---------- 3) Ideias de tema ----------
  function ideasSystem() {
    return `Você é um estrategista de conteúdo brasileiro. Gere ideias de tema de post fortes e específicas, coerentes com a marca. Responda SOMENTE JSON: { "ideas": string[] } (8 ideias, cada uma uma frase curta de tema, sem numeração).`;
  }
  function ideasUser(m) {
    return `${manualToBrief(m)}\n\nGere 8 ideias de tema de post alinhadas aos pilares e ao cliente ideal.`;
  }

  // ---------- 4) Reescrever legenda ----------
  function rewriteSystem() {
    return `Você reescreve legendas de Instagram mantendo o tom exato da marca. Responda SOMENTE JSON: { "caption": string, "hashtags": string[] }.`;
  }
  function rewriteUser(m, caption, instruction) {
    return `${manualToBrief(m)}\n\nLegenda atual:\n"""\n${caption}\n"""\n\nInstrução: ${instruction || "reescreva mantendo o sentido, melhore o gancho e o ritmo, mantenha o tom da marca."}\nRetorne JSON.`;
  }

  return {
    manualToBrief,
    analyzeSystem, analyzeUser,
    generateSystem, generateUser,
    ideasSystem, ideasUser,
    rewriteSystem, rewriteUser,
  };
})();
