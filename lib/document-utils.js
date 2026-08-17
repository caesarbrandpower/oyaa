/**
 * Detecteert of tekst een gegenereerd document is op basis van aanwezige structuur.
 * Gebruikt op twee plekken:
 *   - server-side (route) om het done-event te corrigeren vóórdat de client het ziet
 *   - client-side (ChatPage) om opgeslagen berichten te classificeren bij het laden
 *
 * Drempel: minimaal 3 bold sectiekoppen (**...**) op een eigen regel, óf 2 markdown
 * headings (#/##/###). Bij twijfel false — een gemiste briefing opnieuw vragen is beter
 * dan een leeg document in de kluis.
 */
export function looksLikeDocument(content) {
  if (!content || content.length < 300) return false;
  const markdownHeadings = (content.match(/^#{1,3}\s+.+$/gm) ?? []).length;
  if (markdownHeadings >= 2) return true;
  const boldSections = (content.match(/^\*\*[^*\n]{2,50}\*\*/gm) ?? []).length;
  return boldSections >= 3 && content.length > 500;
}
