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
    debugger;
    if (parsedResults.length > 0) {
      return parsedResults[0];
    } else {
      console.log('File found but without any results');
      throw new Error();
    }
  } catch (error) {
    console.log('File not found', error);
    throw new Error(`File with id:${fileId} not found`);
  }
};

module.exports = {
  getFileById,
};
