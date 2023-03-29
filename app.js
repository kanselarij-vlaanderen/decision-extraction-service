import { app, errorHandler } from "mu";
import { getFileById } from "./utils/file.js";
import pdfParse from "pdf-parse";

app.get("/", function (req, res) {
  res.send("Hello mu-javascript-template");
});

app.get("/:notaId", async function (req, res) {
  const results = await getFileById(req.params.notaId);
  console.log(results);
  res.send("This route work " + req.params.notaId);
});

app.use(errorHandler);
