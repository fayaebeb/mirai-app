import { MessageSquare, Wand2 } from "lucide-react";

export const promptCategories = [
  {
    name: "出力形式 📄",
    icon: <MessageSquare className="h-4 w-4" />,
    prompts: [
      { text: "会話形式で💬", message: "AさんとBさんの会話形式で出力して", description: "フレンドリーな会話形式で回答します" },
      { text: "箇条書き形式で📝", message: "箇条書き形式で出力して", description: "箇条書き形式で出力します" },
      { text: "表形式で📊", message: "表形式で出力して", description: "表形式で出力します" },
      { text: "FAQ形式で❓", message: "FAQ形式で出力して", description: "FAQ形式で出力します" },
      { text: "比喩・たとえ話形式🎭", message: "比喩・たとえ話形式で出力して", description: "比喩・たとえ話形式で出力します" },
      { text: "簡潔に要約✨", message: "簡潔に要約で出力して", description: "簡潔に要約で出力します" },
    ],
  },
  {
    name: "アシスタント 🤖",
    icon: <Wand2 className="h-4 w-4" />,
    prompts: [
      { text: "＋指示のコツ🎯", message: "質問に対してさらに理解を深めるために、どのような指示をすればよいか提案して", description: "より良い指示の出し方をアドバイスします" },
      { text: "「外部情報なし」🚫", message: "インターネットからの情報を利用しないで", description: "外部情報を使わずに回答します" },
      { text: "初心者向け📘", message: "説明に出てくる専門用語には、それぞれ説明を加え、初心者でも理解しやすいように。具体的な例を挙げながら丁寧に解説して", description: "具体的な例を挙げながら丁寧に解説します" },
    ],
  },
];
