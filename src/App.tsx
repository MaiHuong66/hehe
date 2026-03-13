import React, { useState, useEffect } from "react";
import { 
  Upload, 
  BookOpen, 
  ClipboardCheck, 
  Send, 
  CheckCircle, 
  GraduationCap, 
  Users,
  FileText,
  Loader2,
  ChevronRight,
  Lock,
  LogOut,
  ShieldCheck,
  MessageSquare,
  X,
  Bot,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { generateLecture, generateQuiz, gradeQuiz, askQuestion } from "./services/aiService";
import { Lesson, Quiz, StudentResult } from "./types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [password, setPassword] = useState("");

  const [step, setStep] = useState(2); // Default to lessons for students
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; assessment: string } | null>(null);
  const [allResults, setAllResults] = useState<StudentResult[]>([]);

  // Q&A State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    const init = async () => {
      await fetchResults();
      await fetchContent();
      setIsInitialLoading(false);
    };
    init();

    // Polling for new content every 15 seconds for students
    const interval = setInterval(() => {
      if (role === "student") {
        fetchContent();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [role]);

  const fetchResults = async () => {
    try {
      const res = await fetch("/api/results");
      const data = await res.json();
      setAllResults(data);
    } catch (error) {
      console.error("Failed to fetch results", error);
    }
  };

  const fetchContent = async () => {
    try {
      const res = await fetch("/api/content");
      const data = await res.json();
      const fetchedLessons = data.lessons || [];
      const fetchedQuiz = data.quiz || null;
      
      setLessons(fetchedLessons);
      setQuiz(fetchedQuiz);
      
      // Safety for students: always ensure they are on step 2 or 3 if content exists
      if (role === "student") {
        if (fetchedLessons.length > 0 && step === 1) {
          setStep(2);
        }
      }
    } catch (error) {
      console.error("Failed to fetch content", error);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setIsTeacherLoggedIn(true);
        setRole("teacher");
        setShowLoginModal(false);
        setStep(1);
        setPassword("");
      } else {
        alert("Sai mật khẩu!");
      }
    } catch (error) {
      alert("Lỗi đăng nhập");
    }
  };

  const handleLogout = () => {
    setIsTeacherLoggedIn(false);
    setRole("student");
    setStep(lessons.length > 0 ? 2 : 1);
  };

  const handleGenerateLecture = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    try {
      const generatedLessons = await generateLecture(inputText);
      setLessons(generatedLessons);
      
      // Save to backend
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: generatedLessons })
      });
      
      if (!res.ok) throw new Error("Failed to save lessons to server");
      
      setStep(2);
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi tạo bài giảng.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLesson = async () => {
    if (role === "teacher") {
      setLoading(true);
      try {
        const generatedQuiz = await generateQuiz(lessons);
        setQuiz(generatedQuiz);
        
        // Save to backend
        const res = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quiz: generatedQuiz })
        });

        if (!res.ok) throw new Error("Failed to save quiz to server");
        
        setStep(3);
      } catch (error) {
        console.error(error);
        alert("Có lỗi xảy ra khi tạo bài kiểm tra.");
      } finally {
        setLoading(false);
      }
    } else {
      setStep(3);
    }
  };

  const handleAskQuestion = async () => {
    if (!chatInput.trim() || isAsking) return;
    
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsAsking(true);

    try {
      const answer = await askQuestion(userMsg, lessons);
      setChatMessages(prev => [...prev, { role: "ai", text: answer }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: "ai", text: "Xin lỗi, đã có lỗi xảy ra khi xử lý câu hỏi của bạn." }]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!studentName || !className) {
      alert("Vui lòng nhập tên và lớp.");
      return;
    }
    setLoading(true);
    try {
      const graded = await gradeQuiz(quiz!.questions, answers);
      setResult(graded);
      
      // Save to database
      await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          className,
          score: graded.score,
          assessment: graded.assessment
        })
      });
      
      fetchResults();
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi chấm điểm.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          setInputText(prev => prev + "\n" + e.target?.result);
        };
        reader.readAsText(file);
      } else {
        // For other files, we just inform the user we're using the metadata or they should paste text
        setInputText(prev => prev + `\n[Tệp đính kèm: ${file.name}]`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AI Tutor</h1>
              <p className="text-xs text-black/50 font-medium uppercase tracking-wider">Tin học đại cương</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-8">
            {role === "teacher" && (
              <div 
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer",
                  step === 1 ? "text-emerald-600" : "text-black/30"
                )}
                onClick={() => setStep(1)}
              >
                <FileText size={18} />
                <span>Tài liệu</span>
              </div>
            )}
            <div 
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer",
                step === 2 ? "text-emerald-600" : "text-black/30"
              )}
              onClick={() => lessons.length > 0 && setStep(2)}
            >
              <BookOpen size={18} />
              <span>Bài giảng</span>
            </div>
            <div 
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer",
                step === 3 ? "text-emerald-600" : "text-black/30"
              )}
              onClick={() => quiz && setStep(3)}
            >
              <ClipboardCheck size={18} />
              <span>Kiểm tra</span>
            </div>

            <div className="h-6 w-px bg-black/10 mx-2" />

            {isTeacherLoggedIn ? (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
              >
                <LogOut size={18} />
                Thoát
              </button>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <Lock size={18} />
                Giảng viên
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {isInitialLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-emerald-600" size={48} />
            <p className="text-black/40 font-medium">Đang tải dữ liệu học tập...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
          {/* AI CHAT WIDGET (Only if lessons exist) */}
          {lessons.length > 0 && (
            <div className="fixed bottom-8 right-8 z-[60]">
              <AnimatePresence>
                {isChatOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    className="absolute bottom-20 right-0 w-96 h-[500px] bg-white rounded-3xl shadow-2xl border border-black/5 flex flex-col overflow-hidden"
                  >
                    {/* Chat Header */}
                    <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot size={20} />
                        <span className="font-bold">Trợ giảng AI</span>
                      </div>
                      <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                        <X size={20} />
                      </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9F9F7]">
                      {chatMessages.length === 0 && (
                        <div className="text-center py-10 space-y-3">
                          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <Sparkles size={24} />
                          </div>
                          <p className="text-sm text-black/40 px-6">Chào bạn! Tôi là trợ giảng AI. Bạn có thắc mắc gì về bài học không?</p>
                        </div>
                      )}
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed",
                            msg.role === "user" ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white border border-black/5 text-black/80 rounded-tl-none shadow-sm"
                          )}>
                            <Markdown>{msg.text}</Markdown>
                          </div>
                        </div>
                      ))}
                      {isAsking && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-black/5 p-3 rounded-2xl rounded-tl-none shadow-sm">
                            <Loader2 className="animate-spin text-emerald-600" size={16} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 bg-white border-t border-black/5">
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full p-3 pr-12 bg-[#F9F9F7] border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                          placeholder="Đặt câu hỏi..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                        />
                        <button 
                          onClick={handleAskQuestion}
                          disabled={!chatInput.trim() || isAsking}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={cn(
                  "w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                  isChatOpen ? "bg-white text-emerald-600 border border-black/5" : "bg-emerald-600 text-white"
                )}
              >
                {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
              </button>
            </div>
          )}

          {/* LOGIN MODAL */}
          {showLoginModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowLoginModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-xl font-bold">Đăng nhập Giảng viên</h3>
                  <p className="text-sm text-black/40">Vui lòng nhập mật khẩu để quản lý tài liệu</p>
                </div>

                <div className="space-y-4">
                  <input 
                    type="password"
                    className="w-full p-4 bg-[#F9F9F7] border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-center text-xl tracking-widest"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    autoFocus
                  />
                  <button 
                    onClick={handleLogin}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all"
                  >
                    Đăng nhập
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* WINDOW 1: INPUT (Teacher Only) */}
          {step === 1 && role === "teacher" && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <FileText className="text-emerald-600" />
                  Cửa sổ 1: Nhập tài liệu
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-black/60">Nội dung tài liệu (Paste Text)</label>
                    <textarea 
                      className="w-full h-64 p-6 bg-[#F9F9F7] border border-black/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none text-lg leading-relaxed"
                      placeholder="Dán nội dung bài học vào đây..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative group">
                      <input 
                        type="file" 
                        multiple 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.txt"
                      />
                      <div className="h-32 border-2 border-dashed border-black/10 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:border-emerald-500 group-hover:bg-emerald-50/50 transition-all">
                        <Upload className="text-black/30 group-hover:text-emerald-600" />
                        <p className="text-sm font-medium text-black/40 group-hover:text-emerald-700">Tải lên file (PDF, Word, Excel, Ảnh...)</p>
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button 
                        onClick={handleGenerateLecture}
                        disabled={loading || !inputText.trim()}
                        className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 disabled:bg-black/10 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-600/20"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                        📤 Gửi tài liệu
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* NO CONTENT MESSAGE */}
          {step === 2 && lessons.length === 0 && (
            <motion.div 
              key="no-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl p-20 text-center border border-black/5"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen size={40} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Chưa có bài giảng</h3>
              <p className="text-black/40 mb-8">Vui lòng đợi giảng viên cập nhật tài liệu học tập.</p>
              <button 
                onClick={() => fetchContent()}
                className="px-6 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-all flex items-center gap-2 mx-auto"
              >
                <Loader2 className={cn("animate-spin", !loading && "hidden")} size={18} />
                Tải lại trang
              </button>
            </motion.div>
          )}

          {/* WINDOW 2: LECTURE */}
          {step === 2 && lessons.length > 0 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <BookOpen className="text-emerald-600" />
                    Cửa sổ 2: Bài giảng tự động từ AI
                  </h2>
                  <button 
                    onClick={handleCompleteLesson}
                    disabled={loading}
                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                    ✅ Hoàn thành bài học
                  </button>
                </div>

                <div className="space-y-12">
                  {lessons.map((lesson, idx) => (
                    <div key={idx} className="border-b border-black/5 pb-12 last:border-0">
                      <div className="flex items-start gap-6">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xl shrink-0">
                          {idx + 1}
                        </div>
                        <div className="space-y-6">
                          <h3 className="text-3xl font-bold text-black/90">{lesson.title}</h3>
                          
                          <div className="prose prose-emerald max-w-none">
                            <div className="bg-[#F9F9F7] p-6 rounded-2xl border-l-4 border-emerald-500">
                              <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-3">Nội dung bài học</h4>
                              <Markdown>{lesson.content}</Markdown>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                              <h4 className="text-sm font-bold uppercase tracking-widest text-blue-600 mb-3">Ví dụ minh họa</h4>
                              <p className="text-blue-900/80 leading-relaxed">{lesson.example}</p>
                            </div>
                            <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
                              <h4 className="text-sm font-bold uppercase tracking-widest text-amber-600 mb-3">Ví dụ thực tế</h4>
                              <p className="text-amber-900/80 leading-relaxed">{lesson.realWorldExample}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* WINDOW 3: QUIZ */}
          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              {!result ? (
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                  <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                    <ClipboardCheck className="text-emerald-600" />
                    Cửa sổ 3: Bài kiểm tra
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    <div>
                      <label className="block text-sm font-bold mb-2 text-black/60">Họ và tên</label>
                      <input 
                        className="w-full p-4 bg-[#F9F9F7] border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        placeholder="Nguyễn Văn A"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2 text-black/60">Tên lớp</label>
                      <input 
                        className="w-full p-4 bg-[#F9F9F7] border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        placeholder="CNTT1"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-10">
                    {quiz?.questions.map((q, idx) => (
                      <div key={q.id} className="p-6 bg-[#F9F9F7] rounded-2xl border border-black/5">
                        <p className="font-bold text-lg mb-4 flex gap-3">
                          <span className="text-emerald-600">Câu {idx + 1}:</span>
                          {q.question}
                        </p>
                        
                        {q.type === "multiple-choice" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.options?.map((opt, i) => (
                              <button
                                key={i}
                                onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                                className={cn(
                                  "p-4 text-left rounded-xl border transition-all",
                                  answers[q.id] === opt 
                                    ? "bg-emerald-600 text-white border-emerald-600" 
                                    : "bg-white border-black/5 hover:border-emerald-500"
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <textarea 
                            className="w-full p-4 bg-white border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none min-h-[100px]"
                            placeholder="Nhập câu trả lời của bạn..."
                            value={answers[q.id] || ""}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 flex justify-center">
                    <button 
                      onClick={handleSubmitQuiz}
                      disabled={loading}
                      className="px-12 py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xl flex items-center gap-3 transition-all shadow-xl shadow-emerald-600/20"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                      📨 Nộp bài
                    </button>
                  </div>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl p-12 shadow-sm border border-black/5 text-center"
                >
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={48} />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Kết quả bài làm</h2>
                  <p className="text-black/50 mb-8">Chúc mừng {studentName} đã hoàn thành bài kiểm tra!</p>
                  
                  <div className="inline-block bg-emerald-600 text-white px-12 py-6 rounded-3xl mb-8">
                    <p className="text-sm uppercase tracking-widest font-bold opacity-70">Điểm số</p>
                    <p className="text-6xl font-black">{result.score}/10</p>
                  </div>

                  <div className="max-w-2xl mx-auto bg-[#F9F9F7] p-8 rounded-2xl border border-black/5 text-left mb-12">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-4">Đánh giá từ AI</h4>
                    <p className="text-lg leading-relaxed italic">"{result.assessment}"</p>
                  </div>

                  {/* SHOW ANSWERS */}
                  <div className="max-w-4xl mx-auto mb-12 text-left">
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                      <ClipboardCheck className="text-emerald-600" />
                      Đáp án chi tiết
                    </h3>
                    <div className="space-y-6">
                      {quiz?.questions.map((q, idx) => (
                        <div key={q.id} className="p-6 bg-white rounded-2xl border border-black/5 shadow-sm">
                          <p className="font-bold mb-4">
                            <span className="text-emerald-600">Câu {idx + 1}:</span> {q.question}
                          </p>
                          
                          <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-black/[0.02] border border-black/5">
                              <span className="text-xs font-bold uppercase text-black/40 block mb-1">Câu trả lời của bạn</span>
                              <p className={cn(
                                "font-medium",
                                q.type === "multiple-choice" 
                                  ? (answers[q.id] === q.correctAnswer ? "text-emerald-600" : "text-red-600")
                                  : "text-black/70"
                              )}>
                                {answers[q.id] || "(Chưa trả lời)"}
                              </p>
                            </div>
                            
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                              <span className="text-xs font-bold uppercase text-emerald-600/60 block mb-1">Đáp án đúng</span>
                              <p className="font-bold text-emerald-700">{q.correctAnswer}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setStep(1);
                      setResult(null);
                      setAnswers({});
                      setInputText("");
                    }}
                    className="text-emerald-600 font-bold hover:underline flex items-center gap-2 mx-auto"
                  >
                    Quay lại trang chủ <ChevronRight size={18} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        )}

        {/* RESULTS TABLE (Only for Teacher) */}
        {role === "teacher" && (
          <div className="mt-24">
            <div className="flex items-center gap-3 mb-8">
              <Users className="text-emerald-600" />
              <h2 className="text-2xl font-bold">Bảng kết quả học tập (Dành cho Giảng viên)</h2>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F9F9F7] border-b border-black/5">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-black/40">STT</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-black/40">Họ tên</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-black/40">Tên lớp</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-black/40">Điểm</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-black/40">Đánh giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {allResults.map((res, idx) => (
                    <tr key={res.id} className="hover:bg-black/[0.02] transition-colors">
                      <td className="px-6 py-4 font-mono text-black/40">{idx + 1}</td>
                      <td className="px-6 py-4 font-bold">{res.studentName}</td>
                      <td className="px-6 py-4 text-black/60">{res.className}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-sm font-bold",
                          res.score >= 8 ? "bg-emerald-100 text-emerald-700" :
                          res.score >= 5 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {res.score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-black/60 italic">
                        {res.assessment.length > 100 ? res.assessment.substring(0, 100) + "..." : res.assessment}
                      </td>
                    </tr>
                  ))}
                  {allResults.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-black/30 italic">Chưa có kết quả nào được ghi nhận.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-black/5 text-center text-black/30 text-sm">
        <p>© 2026 AI Tutor - Môn Tin học đại cương. Powered by Google AI.</p>
      </footer>
    </div>
  );
}
