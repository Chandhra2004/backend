require("dotenv").config(); // Load environment variables

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function checkModelAvailability(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const response = await model.generateContent("Hello!");
    console.log(`✅ Model '${modelName}' is available!`);
  } catch (error) {
    console.error(`❌ Model '${modelName}' is not available:`, error.message);
  }
}

// Test with possible Gemini models
const modelsToTest = ["gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro", "gemini-1.5-flash"];

(async () => {
  for (const model of modelsToTest) {
    await checkModelAvailability(model);
  }
})();
