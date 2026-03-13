import type { VercelRequest, VercelResponse } from "@vercel/node"

const PASSWORD = "admin"

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed")
  }

  const { password } = req.body

  if (password === PASSWORD) {

    res.json({
      success: true,
      role: "teacher"
    })

  } else {

    res.status(401).json({
      success: false,
      message: "Sai mật khẩu"
    })

  }

}
