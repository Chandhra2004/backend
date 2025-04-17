const express = require("express");
const axios = require("axios");
const router = express.Router();
const SkillModel = require("../models/Skill");
const UserModel = require("../models/User");
const mongoose = require("mongoose"); 
const ollama = require("ollama").default
const Application = require("../models/Application");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);



// Function to extract skills using Ollama AI
// const extractSkills = async (paragraph) => {
//   try {
//     const prompt = `Extract only the skills and technologies from the following text and return them as a JSON array. Do not add any explanation, just return a valid JSON array:\n\n"${paragraph}"`;

//     const response = await axios.post("http://localhost:11434/api/generate", {
//       model: "llama3", // Use "mistral" if needed
//       prompt: prompt,
//       stream: false,
//     });

//     let extractedText = response.data.response.trim(); // Clean response

//     // Ensure valid JSON parsing
//     try {
//       return JSON.parse(extractedText.match(/\[.*?\]/)?.[0] || "[]");
//     } catch (jsonError) {
//       console.error("JSON Parsing Error:", jsonError);
//       return extractedText.replace(/[\[\]"]/g, "").split(/\s*,\s*/).filter(skill => skill.length > 0);
//     }
//   } catch (error) {
//     console.error("Error extracting skills:", error);
//     return [];
//   }
// };

const extractSkills = async (paragraph) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Extract only the skills and technologies from the following text and return them as a JSON array.
    Do not add any explanation, just return a valid JSON array:
    
    "${paragraph}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text(); 

    console.log("Gemini Response:", text); 

    
    const extractedSkills = JSON.parse(text.match(/\[.*?\]/)?.[0] || "[]");
    return extractedSkills;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};



// const generateQuestions = async (skills) => {
//   try {
//     const prompt = `Generate 3 multiple-choice questions to assess proficiency in the following skills: ${skills.join(
//       ", "
//     )}. Each question should have exactly 4 answer options (A, B, C, D) and indicate the correct answer.

//     **Return ONLY a valid JSON object** with the following structure:
//     {
//       "questions": [
//         {
//           "question": "What is JavaScript?",
//           "options": ["A. Programming language", "B. Database", "C. Operating system", "D. Framework"],
//           "correct_answer": "A"
//         }
//       ]
//     }`;

//     const response = await ollama.chat({
//       model: "llama3",
//       messages: [
//         { role: "system", content: "You are a quiz generation AI. Always return JSON format." },
//         { role: "user", content: prompt }
//       ],
//       stream: true
//     });

//     let res = "";
//     for await (const part of response) {
//       if (part.message && part.message.content) {
//         res += part.message.content;  // Accumulate response content
//       }
//     }

//     console.log("Raw Ollama Response:", res); // Debugging

//     // Extract JSON using regex to remove extra text
//     const jsonMatch = res.match(/\{[\s\S]*\}/); 
//     if (!jsonMatch) {
//       throw new Error("No valid JSON found in Ollama response.");
//     }

//     const jsonString = jsonMatch[0]; // Extract matched JSON
//     const parsedResponse = JSON.parse(jsonString);

//     if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
//       throw new Error("Invalid JSON structure from Ollama.");
//     }

//     return parsedResponse;
//   } catch (error) {
//     console.error("Ollama API Error:", error.message);
//     throw new Error("Failed to generate questions");
//   }
// };

const generateQuestions = async (skills) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
   

    const prompt = `Generate 10 multiple-choice questions to assess proficiency in the following skills: ${skills.join(", ")}.
    Each question should have exactly 4 answer options (A, B, C, D) and indicate the correct answer.

    Return only a valid JSON object in this format:
    {
      "questions": [
        {
          "question": "What is JavaScript?",
          "options": ["A. Programming language", "B. Database", "C. Operating system", "D. Framework"],
          "correct_answer": "A"
        }
      ]
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text(); 

    console.log("Gemini Response:", text); 

    
    const jsonMatch = text.match(/\{[\s\S]*\}/); 
    if (!jsonMatch) throw new Error("No valid JSON found in Gemini response.");

    const parsedResponse = JSON.parse(jsonMatch[0]);

    if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
      throw new Error("Invalid JSON structure from Gemini.");
    }

    return parsedResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate questions");
  }
};



const evaluateAnswers = (userAnswers, questions) => {
  let score = 0;
  let totalQuestions = questions.length;

  questions.forEach((q) => {
      if (userAnswers[q.question] === q.correct_answer) {
          score += 1; 
      }
  });

  return (score / totalQuestions) * 100; 
};



router.post("/detect", async (req, res) => {
  try {
    const { userId, paragraph } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const detectedSkills = await extractSkills(paragraph);

    
    const existingSkills = await SkillModel.findOne({ userId });
    const updatedSkills = [...new Set([...(existingSkills?.skills || []), ...detectedSkills])];

    await SkillModel.findOneAndUpdate(
      { userId },
      { $set: { skills: updatedSkills } },
      { upsert: true, new: true }
    );

    await UserModel.findByIdAndUpdate(userId, { $set: { skills: updatedSkills } });

    
    res.json({ success: true, skills: updatedSkills });
  } catch (err) {
    console.error("Skill Detection Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});





router.post("/match", async (req, res) => {
  try {
    const { paragraph } = req.body;
    if (!paragraph) return res.status(400).json({ message: "Paragraph is required" });

    
    const detectedSkills = await extractSkills(paragraph);

    if (!detectedSkills.length) {
      return res.status(404).json({ message: "No skills detected." });
    }

    
    const matchedUsers = await UserModel.find({
      skills: { $in: detectedSkills },
    });

    res.json({ success: true, matches: matchedUsers });
  } catch (err) {
    console.error("Skill Matching Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.put("/update-credits/:id", async (req, res) => {
  const { id } = req.params;
  const { credits } = req.body;

  if (isNaN(credits) || credits <= 0) {
    return res.status(400).json({ success: false, message: "Invalid credit value. Choose between 1 to 20." });
  }

  try {
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      id,
      { $inc: { credits: credits } },
      { new: true }
    );

    res.json({ success: true, message: "Credits updated", user: updatedUser });
  } catch (err) {
    console.error("Error updating credits:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



router.post("/generate", async (req, res) => {
  try {
      const { userId } = req.body;

      if (!userId) {
          return res.status(400).json({ message: "User ID is required" });
      }

      
      const user = await UserModel.findById(userId);
      if (!user || !user.skills || user.skills.length === 0) {
          return res.status(400).json({ message: "User has no skills to generate questions" });
      }

      const skills = user.skills;
      
      const generatedQuestions = await generateQuestions(skills);
      const questions = generatedQuestions.questions; 


      await Application.findOneAndUpdate(
        { userId },
        { $set: { questions } },
        { upsert: true, new: true }
      ); 


      res.json({ success: true, questions });
  } catch (error) {
      console.error("Question Generation Error:", error.message);
      res.status(500).json({ message: "Failed to generate questions" });
  }
});

// Route to validate answers
router.post("/validate-answers", async (req, res) => {
  try {
    const { userId, answers } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }
    
    
    const application = await Application.findOne({ userId });
    if (!application || !application.questions) {
      return res.status(400).json({ message: "No questions found for validation" });
    }
    
    const questions = application.questions;
    let score = 0;
    const questionResults = [];
    
    
    console.log("User Answers:", answers);
    console.log("Stored Questions:", questions);
    
  
    questions.forEach((q) => {
      const userAnswer = answers[q.question]; 
      const correctAnswer = q.correct_answer; 
      
      console.log(`\n🔹 Question: ${q.question}`);
      console.log(`   🟢 Correct Answer: ${correctAnswer}`);
      console.log(`   🔴 User Answer: ${userAnswer}`);
      
      
      const selectedOptionLetter = userAnswer?.split(".")[0].trim(); 
      
      console.log(`   🔍 Extracted Option: ${selectedOptionLetter}`);
      
      const isCorrect = selectedOptionLetter && selectedOptionLetter === correctAnswer;
      if (isCorrect) {
        score += 1; 
      }
      
      
      questionResults.push({
        question: q.question,
        userAnswer: userAnswer,
        correctAnswer: correctAnswer,
        isCorrect: isCorrect
      });
    });
    
    
    const earnedCredits = score * 10;
    
    
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { credits: earnedCredits } },
      { new: true } 
    );
    
    res.json({
      success: true,
      score,
      questionResults, 
      updatedCredits: updatedUser.credits,
      message: `Your score is ${score}. Credits updated to ${updatedUser.credits}.`
    });
  } catch (error) {
    console.error("Answer Validation Error:", error);
    res.status(500).json({ message: "Failed to validate answers" });
  }
});


module.exports = router;
