import { useState } from "react"

export default function App() {

  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)

  async function askAI() {

    setLoading(true)

    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: question
      })
    })

    const data = await res.json()

    setAnswer(data.text)
    setLoading(false)

  }

  return (

    <div style={{ padding: 40, fontFamily: "Arial" }}>

      <h1>AI Tutor - Tin học đại cương</h1>

      <textarea
        rows={5}
        style={{ width: "100%" }}
        placeholder="Nhập câu hỏi..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <br /><br />

      <button onClick={askAI}>
        Hỏi AI
      </button>

      {loading && <p>AI đang trả lời...</p>}

      <h3>Kết quả:</h3>

      <div
        style={{
          background: "#eee",
          padding: 20,
          whiteSpace: "pre-wrap"
        }}
      >
        {answer}
      </div>

    </div>

  )

}
