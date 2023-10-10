require("dotenv").config();
const express = require("express");
const request = require("request");
const cors = require("cors");
const port = process.env.PORT || 8080;
const app = express();

//middlewere
app.use(cors());
app.use(express.json());

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});