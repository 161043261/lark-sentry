export function getCssSelectors(
  elem: Element,
): [idSelector: string, classAttrSelector: string, elemSelector: string] {
  if (!elem || elem.nodeType !== 1) {
    return ["", "", ""];
  }
  const excludedAttrs = ["id", "class", "style"];
  const idSelector = elem.id ? `#${elem.id}` : "";
  const classSelector = Array.from(elem.classList)
    .map((c) => `.${c}`)
    .join("");
  const attrSelector = Array.from(elem.attributes)
    .filter((attr) => !excludedAttrs.includes(attr.name))
    .map((attr) => `[${attr.name}="${attr.value}"]`)
    .join("");
  const elemSelector = elem.tagName.toLowerCase();
  return [idSelector, classSelector + attrSelector, elemSelector];
}

export default getCssSelectors;
