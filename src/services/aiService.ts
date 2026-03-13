import { GoogleGenAI, Type } from "@google/genai";
import { Lesson, Quiz, QuizQuestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateLecture = async (content: string): Promise<Lesson[]> => {
  const model = "gemini-3.1-pro-preview";
  const response = await ai.models.generateContent({
    model,
    contents: `Bạn là một chuyên gia giáo dục và giảng viên đại học môn "Tin học đại cương". 
    Dựa trên tài liệu sau đây, hãy thiết kế một chuỗi các bài giảng chi tiết, dễ hiểu và có tính sư phạm cao.
    
    Yêu cầu cho mỗi bài giảng:
    1. Tiêu đề: Rõ ràng, thu hút.
    2. Nội dung bài học: Giải thích chi tiết các khái niệm, sử dụng các tiêu đề phụ, danh sách liệt kê để dễ theo dõi. Nội dung phải sâu sắc nhưng ngôn ngữ phải đơn giản.
    3. Ví dụ minh họa: Đưa ra các ví dụ cụ thể về kỹ thuật hoặc lý thuyết vừa học.
    4. Ví dụ thực tế: Liên hệ kiến thức với đời sống hàng ngày hoặc công việc thực tế để sinh viên thấy được giá trị của bài học.

    Tài liệu: ${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            example: { type: Type.STRING },
            realWorldExample: { type: Type.STRING },
          },
          required: ["title", "content", "example", "realWorldExample"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
};

export const generateQuiz = async (lessons: Lesson[]): Promise<Quiz> => {
  const model = "gemini-3.1-pro-preview";
  const lessonsText = lessons.map(l => l.title + ": " + l.content).join("\n");
  
  const response = await ai.models.generateContent({
    model,
    contents: `Dựa trên các bài giảng sau, hãy tạo một bài kiểm tra gồm 10 câu trắc nghiệm và 5 câu tự luận ngắn.
    Câu hỏi phải bám sát nội dung, mức độ trung bình đến khó.
    
    Bài giảng: ${lessonsText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                type: { type: Type.STRING, enum: ["multiple-choice", "short-answer"] },
                question: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Chỉ dành cho câu hỏi trắc nghiệm"
                },
                correctAnswer: { type: Type.STRING },
              },
              required: ["id", "type", "question", "correctAnswer"],
            },
          },
        },
        required: ["questions"],
      },
    },
  });

  return JSON.parse(response.text || '{"questions": []}');
};

export const gradeQuiz = async (
  questions: QuizQuestion[], 
  answers: Record<number, string>
): Promise<{ score: number; assessment: string }> => {
  const model = "gemini-3.1-pro-preview";
  const data = questions.map(q => ({
    question: q.question,
    correctAnswer: q.correctAnswer,
    studentAnswer: answers[q.id] || "Không trả lời"
  }));

  const response = await ai.models.generateContent({
    model,
    contents: `Hãy chấm điểm bài làm sau đây trên thang điểm 10. 
    Đưa ra nhận xét công bằng, phân tích mức độ hiểu bài của sinh viên.
    Dữ liệu bài làm: ${JSON.stringify(data)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          assessment: { type: Type.STRING },
        },
        required: ["score", "assessment"],
      },
    },
  });

  return JSON.parse(response.text || '{"score": 0, "assessment": "Không có nhận xét"}');
};

export const askQuestion = async (
  question: string,
  lessons: Lesson[]
): Promise<string> => {
  const model = "gemini-3.1-pro-preview";
  const context = lessons.map(l => `Chủ đề: ${l.title}\nNội dung: ${l.content}`).join("\n\n");

  const response = await ai.models.generateContent({
    model,
    contents: `Bạn là một trợ giảng AI cho môn "Tin học đại cương". 
    Dựa trên nội dung bài giảng dưới đây, hãy trả lời câu hỏi của sinh viên một cách ngắn gọn, dễ hiểu và chính xác.
    Nếu câu hỏi không liên quan đến nội dung bài giảng, hãy lịch sự từ chối và khuyên sinh viên tập trung vào bài học.

    Nội dung bài giảng:
    ${context}

    Câu hỏi của sinh viên: ${question}`,
  });

  return response.text || "Xin lỗi, tôi không thể tìm thấy câu trả lời trong tài liệu.";
};
