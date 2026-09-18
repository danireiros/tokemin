function words(text) {
  return String(text ?? "").split(/(\s+)/).filter((part) => part.length);
}

export function diffWords(before, after) {
  const a = words(before);
  const b = words(after);
  const parts = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      parts.push({ type: "eq", text: a[i] });
      i += 1;
      j += 1;
      continue;
    }

    const nextB = b.indexOf(a[i], j);
    const nextA = a.indexOf(b[j], i);
    if (nextB !== -1 && (nextA === -1 || nextB - j <= nextA - i) && nextB - j < 12) {
      while (j < nextB) {
        parts.push({ type: "ins", text: b[j] });
        j += 1;
      }
    } else if (nextA !== -1 && nextA - i < 12) {
      while (i < nextA) {
        parts.push({ type: "del", text: a[i] });
        i += 1;
      }
    } else {
      parts.push({ type: "del", text: a[i] });
      parts.push({ type: "ins", text: b[j] });
      i += 1;
      j += 1;
    }
  }

  while (i < a.length) {
    parts.push({ type: "del", text: a[i] });
    i += 1;
  }
  while (j < b.length) {
    parts.push({ type: "ins", text: b[j] });
    j += 1;
  }

  const merged = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && last.type === part.type) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

export function renderDiff(before, after) {
  return diffWords(before, after)
    .map((part) => {
      const safe = escapeHtml(part.text);
      if (part.type === "del") return `<del>${safe}</del>`;
      if (part.type === "ins") return `<ins>${safe}</ins>`;
      return safe;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
