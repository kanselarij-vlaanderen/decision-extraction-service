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
    const trimmed = text.trim();
    const noDoubleSpaces = trimmed.replace(/  +/g, " ");
    const htmlLineBreaks = noDoubleSpaces.replace(/\n/g, "<br />");
    return htmlLineBreaks;
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
    const finalDecisionText = cleanedDecisionText || rawDecisionText

    res.send({ content: finalDecisionText});
  } catch(e){
    console.log("error", e)
    res.status(500);
    res.send();
  }
});

app.use(errorHandler);
