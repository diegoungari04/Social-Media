/* store.js — estado + persistência (localStorage) */
window.Store = (function () {
  const K = {
    manual: "pf_manual",
    settings: "pf_settings",
    library: "pf_library",
    calendar: "pf_calendar",
  };

  function read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      return false;
    }
  }

  const defaultManual = {
    brand: "",
    niche: "",
    client: "",
    differentials: [],
    tone: [],
    person: "Fala como 'a gente' / nós, incluindo o leitor",
    emoji: "poucos e pontuais",
    topics: [],
    phrases: [],
    hashtags: [],
    cta: "",
    visualStyle: "",
    colors: { accent: "#4c5c2b", dark: "#2e3a1c", light: "#f4f1e8", ontext: "#ffffff" },
    fonts: { head: "Playfair Display", body: "Inter" },
  };

  const sampleManual = {
    brand: "Diego Ungari",
    niche: "liderança, carreira e bem-estar no trabalho",
    client:
      "Profissionais e líderes ocupados que se orgulham da dedicação, mas vivem exaustos. Sentem que 'equilíbrio' é impossível e confundem estar sempre disponível com comprometimento. Desejam performar sem adoecer.",
    differentials: [
      "Olhar crítico sobre produtividade tóxica e cultura de aparência",
      "Une dado concreto com provocação afiada",
      "Fala direta, sem clichê de coach ou motivação vazia",
    ],
    tone: ["Provocativo", "Direto", "Reflexivo", "Empático", "Coloquial brasileiro"],
    person: "Fala como 'a gente' / nós, incluindo o leitor",
    emoji: "poucos e pontuais",
    topics: [
      "Equilíbrio vida-trabalho de verdade",
      "Produtividade real vs. aparência de esforço",
      "Cultura, gestão e respeito pelo tempo humano",
      "Autoconhecimento e escolhas de carreira",
    ],
    phrases: [
      "Isso não é X, é Y disfarçado.",
      "Você já foi pego nessa armadilha?",
    ],
    hashtags: ["#carreira", "#equilibriodevida", "#bemestar", "#lideranca", "#ungari"],
    cta: "Comenta aqui como você tem lidado com isso 👇",
    visualStyle: "Fotografia realista de escritório aconchegante e natural: notebook, café, caderno e planta com luz de janela. Tons terrosos e quentes, clima calmo e sofisticado.",
    colors: { accent: "#4c5c2b", dark: "#2e3a1c", light: "#f4f1e8", ontext: "#ffffff" },
    fonts: { head: "Playfair Display", body: "Inter" },
  };

  return {
    K,
    getManual: () => read(K.manual, structuredClone(defaultManual)),
    saveManual: (m) => write(K.manual, m),
    defaultManual: () => structuredClone(defaultManual),
    sampleManual: () => structuredClone(sampleManual),

    getSettings: () => read(K.settings, { apiKey: "", model: "claude-sonnet-5", imgProvider: "pollinations", openaiKey: "" }),
    saveSettings: (s) => write(K.settings, s),

    getCalendar: () => read(K.calendar, []),
    saveCalendar: (arr) => write(K.calendar, arr),

    getLibrary: () => read(K.library, []),
    saveLibrary: (arr) => write(K.library, arr),
    addToLibrary: (post) => {
      const lib = read(K.library, []);
      post.id = post.id || "p_" + Date.now();
      post.savedAt = Date.now();
      const idx = lib.findIndex((p) => p.id === post.id);
      if (idx >= 0) lib[idx] = post;
      else lib.unshift(post);
      write(K.library, lib);
      return post.id;
    },
    removeFromLibrary: (id) => {
      const lib = read(K.library, []).filter((p) => p.id !== id);
      write(K.library, lib);
    },
  };
})();
