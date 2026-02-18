const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testNewModel() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log("Testing gemini-2.0-flash...");
        const result = await model.generateContent("Hello, are you working?");
        console.log("Response:", result.response.text());
        console.log("SUCCESS: gemini-2.0-flash works!");
    } catch (error) {
        console.error("FAILED:", error.message);
    }
}

testNewModel();
