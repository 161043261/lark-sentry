function dom2str(target: HTMLElement, maxDepth = 10): string {
  if (maxDepth <= 0) {
    return "...";
  }
  const tagName = target.tagName.toLowerCase();

  const attrs = Array.from(target.attributes)
    .map((attr) => ` ${attr.name}="${attr.value}"`)
    .join("");

  const children = Array.from(target.children)
    .map((child) => dom2str(child as HTMLElement, maxDepth - 1))
    .join("");

  return `<${tagName}${attrs}>${children}</${tagName}>`;
}

export default dom2str;
