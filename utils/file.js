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

const getFileById = async function (fileId) {
  const q = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX dbpedia: <http://dbpedia.org/ontology/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

SELECT (?uuid as ?id) ?name ?format ?size ?extension ?created ?modified
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
}
LIMIT 1
  `;

  let results;
  try {
    results = await query(q); // NO SUDO
  } catch (error) {
    console.log('this is the error":' + error);
    return null;
  }

  const parsedResults = parseSparqlResults(results);
  if (parsedResults.length > 0) {
    return parsedResults[0];
  } else {
    return null;
  }
};

module.exports = {
  getFileById,
};
