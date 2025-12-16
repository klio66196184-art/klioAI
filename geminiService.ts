
import { GoogleGenAI, Type } from "@google/genai";
import { StudentData, AnalysisResult } from "../types";

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "學生體質狀況的專業總結。" },
    bmiCategory: { type: Type.STRING, description: "BMI 狀態（如：正常、超重）。" },
    fitnessLevel: { type: Type.STRING, description: "整體體質等級（如：優秀、良好、及格、不及格）。" },
    comparisonMacau: { type: Type.STRING, description: "對照 2020 澳門體質報告的 PR 預估。" },
    comparisonChina: { type: Type.STRING, description: "對照 2014 國家標準的等級判定。" },
    rankingScore: { type: Type.NUMBER, description: "綜合得分（0-100）。" },
    exerciseSuggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "運動處方。" },
    nutritionSuggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "膳食建議。" },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["summary", "bmiCategory", "fitnessLevel", "comparisonMacau", "comparisonChina", "rankingScore", "exerciseSuggestions", "nutritionSuggestions", "strengths", "weaknesses"]
};

const SYSTEM_INSTRUCTION = `你是一位資深營養師與運動學家。
請根據：
1. 中國 2014 國家學生體質標準
2. 澳門 2020 體質監測報告
對數據進行極速精準分析。輸出的 JSON 必須包含專業評核總結、運動處方、膳食建議及評分。`;

export const analyzeStudent = async (student: StudentData): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const prompt = `
    ${student.name}, ${student.gender === 'M' ? '男' : '女'}, ${student.age}歲, ${student.grade}
    身高:${student.height}, 體重:${student.weight}, BMI:${student.bmi}
    握力:${student.handgrip}, 柔韌:${student.sitAndReach}, 跳遠:${student.standingLongJump}, 折返跑:${student.shuttleRun}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    
    return {
      ...JSON.parse(text),
      studentId: student.id
    };
  } catch (error: any) {
    console.error("Analysis Error:", error);
    throw new Error(error.message || "分析失敗");
  }
};
