import app from "./app.js"

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`VERA API running at http://localhost:${PORT}`);
});