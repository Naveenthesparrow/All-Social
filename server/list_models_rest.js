const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
    try {
        const response = await fetch(url);
        const data = await response.json();
        fs.writeFileSync("models.json", JSON.stringify(data, null, 2));
        console.log("Written to models.json");
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

listModels();
