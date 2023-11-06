import {
  app,
  errorHandler,
  query,
  sparqlEscapeString,
} from "mu";
import { getFileById } from "./utils/file.js";
import pdf from "pdf-parse";
import * as fs from "fs";

function toLocalPath(dataSourceUri) {
  return dataSourceUri.replace('share://', '/share/');
}

async function getNotaFile(notaId) {
  const queryString = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>

    SELECT DISTINCT ?uuid WHERE {
      ?s a dossier:Stuk .
      ?s mu:uuid ${sparqlEscapeString(notaId)} .
      {
          ?s prov:value ?file .
      }
      UNION
      {
          ?s prov:value/^prov:hadPrimarySource ?file .
      }
      ?file a nfo:FileDataObject ;
          mu:uuid ?uuid ;
          dct:format ?format .
      FILTER(CONTAINS(?format, "application/pdf"))
    }`;

  const res = await query(queryString);
  if (res.results.bindings.length) {
    return res.results.bindings[0].uuid.value;
  }
  throw new Error(`File for Nota with id ${notaId} not found`);
}

function clean(text) {
  try {
    const pagenumbersRemoved = text.replace(/Pagina\s+[0-9]+\s+van\s+[0-9]+/g, '');
    const forwardSlashesRemoved = pagenumbersRemoved.replace(/\/\/+/g, '\n');
    const signatureIndex = forwardSlashesRemoved.search(/(De minister-president van de Vlaamse Regering)|(De viceminister-president van de Vlaamse Regering)|(De Vlaamse minister van)/);
    let signaturesRemoved = forwardSlashesRemoved;
    if (signatureIndex > -1) {
      signaturesRemoved = signaturesRemoved.slice(0, signatureIndex);
    }
    const trimmed = signaturesRemoved.trim();
    const noDoubleSpaces = trimmed.replace(/  +/g, " ");
    const paragraphs = noDoubleSpaces.split(/\n\s*\n/g);
    const paragraphsAdded = '<p>' + paragraphs.map(paragraph => paragraph.trim().replace(/\n/g, " ")).join('</p>\n<p>') + '</p>';
    const noDoubleNewlines = paragraphsAdded.replace(/<br>\s*(<br>\s*)+/g, "<br>");
    const itemSpacingAdded = noDoubleNewlines.replace(/<p>([0-9]+)\./g, "<p>&nbsp;&nbsp; $1.");
    const subItemSpacingAdded = itemSpacingAdded.replace(/<p>&nbsp;&nbsp;\s*([0-9]+)\.([0-9]+)/g, "<p>&nbsp;&nbsp;&nbsp;&nbsp; $1.$2");
    return subItemSpacingAdded;
  } catch (e) {
    console.log('something went wrong when cleaning the text:', e);
    console.debug('text that could not be cleaned', text);
    return null;
  }
}

app.get("/:notaId", async function (req, res) {
  try {
    const fileId = await getNotaFile(req.params.notaId);
    const results = await getFileById(fileId);

    let dataBuffer = fs.readFileSync(toLocalPath(results.dataSource));

    const { text } = await pdf(dataBuffer);
    const decisionStartToken = "VOORSTEL VAN BESLISSING";
    const decisionStartIndex = text.indexOf(decisionStartToken);
    let rawDecisionText = text;
    // in case we don't find the start token we return all content
    if (decisionStartIndex !== -1) {
      rawDecisionText = text.slice(
        decisionStartIndex + decisionStartToken.length
      );
    }
    let cleanedDecisionText = clean(rawDecisionText);
    let finalDecisionText = cleanedDecisionText || rawDecisionText

    res.send({ content: finalDecisionText});
  } catch(e){
    console.log("error", e)
    res.status(500);
    res.send();
  }
});

app.use(errorHandler);
