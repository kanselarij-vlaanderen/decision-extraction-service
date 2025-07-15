import { query, sparqlEscapeString } from "mu";

const parseSparqlResults = (data) => {
  if (!data) return;
  const vars = data.head.vars;
  return data.results.bindings.map((binding) => {
    const obj = {};
    vars.forEach((varKey) => {
      if (binding[varKey]) {
        obj[varKey] = binding[varKey].value;
      }
    });
    return obj;
  });
};

async function getFileById(fileId) {
  const q = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX dbpedia: <http://dbpedia.org/ontology/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

SELECT ?name ?format ?size ?extension ?created ?modified ?dataSource
WHERE
{
    ?uri a nfo:FileDataObject ;
          mu:uuid ${sparqlEscapeString(fileId)} .
    OPTIONAL { ?uri nfo:fileName ?name }
    OPTIONAL { ?uri dct:format ?format }
    OPTIONAL { ?uri nfo:fileSize ?size }
    OPTIONAL { ?uri dbpedia:fileExtension ?extension }
    OPTIONAL { ?uri dct:created ?created }
    OPTIONAL { ?uri dct:modified ?modified }
    OPTIONAL { ?dataSource nie:dataSource ?uri }
}
LIMIT 1
  `;

  let results;
  try {
    results = await query(q); // NO SUDO
    const parsedResults = parseSparqlResults(results);
    if (parsedResults.length > 0) {
      return parsedResults[0];
    } else {
      console.log("File found but without any results");
      throw new Error();
    }
  } catch (error) {
    console.log("File not found", error);
    throw new Error(`File with id:${fileId} not found`);
  }
};

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

export {
  getFileById,
  getNotaFile,
};
