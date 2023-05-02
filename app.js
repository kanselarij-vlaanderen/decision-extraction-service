import {
  app,
  errorHandler,
  query,
  update,
  sparqlEscapeString,
  sparqlEscapeUri,
  uuid as generateUuid,
} from "mu";
import { getFileById } from "./utils/file.js";
import pdf from "pdf-parse";
import * as fs from "fs";

function toLocalPath(dataSourceUri) {
  return "/share/" + dataSourceUri.slice("share://".length);
}

async function getNotaFile(notaId) {
  const queryString = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    SELECT DISTINCT ?vid WHERE {
      ?s a dossier:Stuk .
      ?s mu:uuid ${sparqlEscapeString(notaId)} .
      ?s prov:value/mu:uuid ?vid .
    }`;

  const res = await query(queryString);
  return res.results.bindings[0].vid.value;
}

function clean(text) {
  const trimmed = text.trim();
  const noDoubleSpaces = trimmed.replaceAll("  ", " ");
  const htmlLineBreaks = noDoubleSpaces.replaceAll("\n", "<br />")

  return htmlLineBreaks;
}

app.get("/:notaId", async function (req, res) {
  const fileId = await getNotaFile(req.params.notaId);
  const results = await getFileById(fileId);

  let dataBuffer = fs.readFileSync(toLocalPath(results.dataSource));

  const { text } = await pdf(dataBuffer);
  const decisionStartToken = "VOORSTEL VAN BESLISSING";
  const decisionStartIndex = text.indexOf(decisionStartToken);
  const rawDecisionText = text.slice(
    decisionStartIndex + decisionStartToken.length
  );
  const cleanedDecisionText = clean(rawDecisionText);

  res.send({ content: cleanedDecisionText });
});

app.use(errorHandler);
