const OPEN = "\uFFF0";
const CLOSE = "\uFFF1";

export function protectBlocks(text, { protectCode = true } = {}) {
  const blocks = [];
  let out = String(text ?? "");

  const stash = (match) => {
    const i = blocks.length;
    blocks.push(match);
    return `${OPEN}${i}${CLOSE}`;
  };

  if (protectCode) {
    out = out.replace(/```[\s\S]*?```/g, stash);
    out = out.replace(/`[^`\n]+`/g, stash);
  }

  out = out.replace(/\bhttps?:\/\/[^\s<>"'`]+/gi, stash);
  out = out.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, stash);

  return { text: out, blocks };
}

export function restoreBlocks(text, blocks = []) {
  return String(text ?? "").replace(/\uFFF0(\d+)\uFFF1/g, (_, n) => blocks[Number(n)] ?? "");
}

export function placeholderPattern() {
  return /\uFFF0\d+\uFFF1/g;
}
