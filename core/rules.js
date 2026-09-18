const FILLERS = [
  "gracias de antemano",
  "if you wouldn't mind",
  "if you don't mind",
  "i would appreciate it if you",
  "i would appreciate if you",
  "i would like you to",
  "i would like you",
  "could you please",
  "would you please",
  "please could you",
  "please would you",
  "si no te importa",
  "me gustaría que",
  "me gustaria que",
  "quisiera que",
  "te agradecería si",
  "te agradeceria si",
  "te agradecería que",
  "te agradeceria que",
  "podrías por favor",
  "podrias por favor",
  "puedes por favor",
  "podrías ayudarme a",
  "podrias ayudarme a",
  "puedes ayudarme a",
  "ayudarme a",
  "ayúdame a",
  "ayudame a",
  "necesito que me",
  "as a language model",
  "you are an ai assistant",
  "you are a helpful assistant",
  "act as if you were",
  "act as a",
  "actúa como un",
  "actúa como una",
  "actua como un",
  "actua como una",
  "eres un asistente",
  "como modelo de lenguaje",
  "la verdad es que",
  "en este momento",
  "a continuación",
  "a continuacion",
  "por favor",
  "i would like",
  "i want you to",
  "can you please",
  "could you",
  "would you",
  "si pudieras",
  "si puedes",
  "cuando puedas",
  "me gustaría",
  "me gustaria",
  "quisiera",
  "podrías",
  "podrias",
  "porfa",
  "porfis",
  "please",
  "kindly",
  "basically",
  "just go ahead and",
  "go ahead and",
  "un saludo",
  "saludos",
  "thanks in advance",
  "thank you in advance",
  "buenos días",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
  "hello there",
  "hi there",
  "hola,",
  "hey,",
];

const DENSE_EN = [
  [/revisa(?:r)? este código/gi, "Review code"],
  [/revisa(?:r)? el código/gi, "Review code"],
  [/revisa(?:r)? este codigo/gi, "Review code"],
  [/lista(?:r)? (?:los )?errores/gi, "List bugs"],
  [/lista(?:r)? (?:los )?bugs/gi, "List bugs"],
  [/resume(?:n)? (?:el |este |la |esta )?/gi, "Summarize "],
  [/traduce(?:r)? (?:al |a )?/gi, "Translate to "],
  [/explica(?:r)? /gi, "Explain "],
  [/reescribe(?:r)? /gi, "Rewrite "],
  [/corrige(?:r)? /gi, "Fix "],
  [/comprime(?:r)? /gi, "Compress "],
  [/sin preámbulo/gi, "no preamble"],
  [/sin preambulo/gi, "no preamble"],
  [/sin introducción/gi, "no intro"],
  [/en viñetas/gi, "as bullets"],
  [/en bullets/gi, "as bullets"],
];

const KEEP = /\b(no|nunca|jamas|jamás|excepto|salvo|ni|sin|not|never|don't|dont|except|unless|cannot|can't)\b/i;

export function stripCodeComments(text) {
  return String(text ?? "").replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang, body) => {
    const cleaned = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\n)[ \t]*\/\/.*(?=\n|$)/g, "$1")
      .replace(/(^|\n)[ \t]*#(?!!|\#).*(?=\n|$)/g, "$1")
      .replace(/\n{3,}/g, "\n\n");
    return `\`\`\`${lang}\n${cleaned}\`\`\``;
  });
}

const NAME_STOP = new Set([
  "Hola", "Gracias", "Please", "Hello", "Thanks", "User", "Assistant", "System",
  "ChatGPT", "Por", "Para", "Este", "Esta", "GOAL", "ROLE", "INPUT", "OUTPUT", "CONSTRAINTS",
]);

export function normalizeWhitespace(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([!?.,;:])/g, "$1")
    .replace(/[.!?]\s*[.!?]/g, (match) => match.trim().slice(-1))
    .trim();
}

export function stripDecorative(text) {
  return String(text ?? "")
    .replace(/^\s*(?:chatgpt said|you said|assistant said|user said)\s*:?\s*/gim, "")
    .replace(/^\s*[-*_=#]{3,}\s*$/gm, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*)+$/gmu, "")
    .replace(/[¿¡]+/g, "")
    .replace(/[ \t]*\*{1,2}([^*]+)\*{1,2}[ \t]*/g, " $1 ");
}

export function stripFillers(text) {
  let out = ` ${text} `;
  for (const phrase of FILLERS) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, "giu"), "$1 ");
  }
  return normalizeWhitespace(out);
}

export function toDenseEnglish(text) {
  let out = String(text ?? "");
  for (const [pattern, replacement] of DENSE_EN) {
    out = out.replace(pattern, replacement);
  }
  return normalizeWhitespace(out.replace(/[ \t]{2,}/g, " "));
}

export function looksProtectedToken(word) {
  return KEEP.test(word);
}

export function collectRiskTokens(text) {
  const words = String(text ?? "").match(/[\p{L}\p{N}#._-]+/gu) || [];
  const numbers = words.filter((w) => /\d/.test(w));
  const negations = words.filter((w) => KEEP.test(w));
  const names = words.filter((w) => /^[\p{Lu}][\p{L}'’-]{2,}$/u.test(w) && !NAME_STOP.has(w));
  return { numbers, negations, names };
}
