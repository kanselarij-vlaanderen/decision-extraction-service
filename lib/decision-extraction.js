async function processExtractedText(textFromPdf) {
  const decisionStartToken = "VOORSTEL VAN BESLISSING";
  const decisionStartIndex = textFromPdf.indexOf(decisionStartToken);
  let rawDecisionText = textFromPdf;
  // in case we don't find the start token we return all content
  if (decisionStartIndex !== -1) {
    rawDecisionText = textFromPdf.slice(
      decisionStartIndex + decisionStartToken.length
    );
  }
  let cleanedDecisionText = cleanNew(rawDecisionText);
  return cleanedDecisionText || rawDecisionText;
}


function cleanNew(text) {
  try {
    // We need to remove:
    // - Classificatie: Klasse x  (before mapping, it can end up in decision text)
    // - Pagina x van x (before mapping, it can end up in decision text)
    // - signature De/de/Vlaams/Vlaamse/minister-president/viceminister-president
    //   (after mapping, the same text may exist in the decision but then it will always be preceded by a number or a list symbol)
    //   (should always be 1 (or more*) separate block(s). * if more than 1 minister signed it)
    // - everything after that first signature block
    // - Bijlagen (after mapping, if it still exists after previous steps, should be a separate block. small use-case where this is found before signatures)
    const trimmedOutside = text.trim();
    const classificationRemoved = trimmedOutside.replace(/Classificatie:\s+Klasse\s+[0-9]+/g, '');
    const pagenumbersRemoved = classificationRemoved.replace(/Pagina\s+[0-9]+\s+van\s+[0-9]+/g, '');
    const forwardSlashesRemoved = pagenumbersRemoved.replace(/\/\/+/g, '\n');
    const paragraphs = forwardSlashesRemoved.split(/\n\s*\n/g);
    
    // remove signatures from the first occurrence
    // 0 should be "De Vlaamse Regering beslist:" But can also contain the entire decision and "De Vlaamse regering" without the "beslist:"
    // 1 is usually the whole or part of the decision. depending on line feeds this index could be the earliest occurrence of the signatures
    // 2 is most likey where the signatures start, but could also be a continuation of the decisions
    // 3 and beyond is often the name(s) of the minister, there could be multiple signature and name indexes
    let signatureIndex;
    for (let index = 1; index < paragraphs.length && !signatureIndex; index++) {
      const element = paragraphs[index];
      // lowercase since variations exist on the word "de" and prevent other capitalization errors from causing issues
      // using "/i" on regex to test case insensitive
      // spaces in front are possible (with or without "de"), we trim just in case
      const elementTrimmed = element.trim();
      // 1 regex to test many possible variations.
      // ^ = string MUST start with (should not match decisions that start (or contain) with list number/symbol f.e. "2. de vlaamse minister")
      // "de " is optional
      // "vlaams minister" and "vlaamse minister" are both used
      // we look for "minister-president" or "viceminister-president" or "vlaams/vlaamse minister"
      // we don't look for "van" (for minister) or "van de Vlaamse Regering" (for the MP en VMP) anymore because some signatures use "bevoegd voor" instead of that.
      const signatureFound = /^[de]*\s*((minister\-president)|(viceminister\-president)|(vlaams[e]*\sminister))/i.test(elementTrimmed);
      if (signatureFound) {
        signatureIndex = index;
      }
    }

    const decisionParagraphs = paragraphs.slice(0, signatureIndex);
    // remove "bijlage" segment if it still exists
    for (let index = decisionParagraphs.length - 1; index >= 0; index--) {
      const element = decisionParagraphs[index];
      // lowercase just in case (seen all capitals)
      // using "/i" on regex to test case insensitive
      // spaces in front are possible, we trim just in case
      const elementTrimmed = element.trim();
      // 1 regex to test many possible variations.
      // ^ = string MUST start with
      // "bijlage" should exist (typos will be ignored)
      // "n" or "s" is optional (seen all three occurrences "bijlage" "bijlagen" "bijlages") so not included in the regex
      // ":" colon optional (seen notas without it in combination with the variations above) so not included in the regex
      if (/^bijlage/i.test(elementTrimmed)) {
        decisionParagraphs.splice(index, 1);
      }
    }

    const paragraphsAdded = '<p>' + decisionParagraphs.map(paragraph => paragraph.trim().replace(/([;\.])+\s*\n/g, "$1<br>").replace(/\n/g, " ")).join('</p>\n<p>') + '</p>';
    const noDoubleNewlines = paragraphsAdded.replace(/<br>\s*(<br>\s*)+/g, "<br>");
    const itemSpacingAdded = noDoubleNewlines.replace(/<p>([0-9]+)\./g, "<p>&nbsp;&nbsp; $1.");
    const subItemSpacingAdded = itemSpacingAdded.replace(/<p>&nbsp;&nbsp;\s*([0-9]+)\.([0-9]+)/g, "<p>&nbsp;&nbsp;&nbsp;&nbsp; $1.$2");
    const noDoubleSpaces = subItemSpacingAdded.replace(/\s+/g, " ");
    return noDoubleSpaces;
  } catch (e) {
    console.log('something went wrong when cleaning the text:', e);
    console.debug('text that could not be cleaned', text);
    return null;
  }
}

export {
  processExtractedText,
};