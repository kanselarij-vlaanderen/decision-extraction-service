import {
  app,
  errorHandler,
} from "mu";
import { getNotaFile, getFileById } from "./lib/file.js";
import { processExtractedText } from "./lib/decision-extraction.js"
import pdf from "pdf-parse";
import * as fs from "fs";

function toLocalPath(dataSourceUri) {
  return dataSourceUri.replace('share://', '/share/');
}

app.get("/:notaId", async function (req, res, next) {
  try {
    const fileId = await getNotaFile(req.params.notaId);
    const results = await getFileById(fileId);

    let dataBuffer = fs.readFileSync(toLocalPath(results.dataSource));

    const { text } = await pdf(dataBuffer);
    const decisionText = await processExtractedText(text);

    res.send({ content: decisionText});
  } catch(e){
    console.log('failed to extract decision');
    console.trace(e);
    return next({ message: 'Could not extract decision from nota', status: 500 });
  }
});

app.use(errorHandler);
