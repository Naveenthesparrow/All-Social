const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        // The SDK doesn't have a direct listModels method exposed on the main instance easily in all versions, 
        // but we can try to use the model to generate content to test, OR use the admin API if available.
        // Actually, newer SDKs might not expose listModels directly.
        // Let's try a simple generation with the current model to see if it works in isolation.

        console.log("Testing gemini-1.5-flash...");
        const result = await model.generateContent("Hello");
        console.log("gemini-1.5-flash works!");
        console.log(result.response.text());
    } catch (error) {
        console.error("gemini-1.5-flash failed:", error.message);
    }
}

listModels();
