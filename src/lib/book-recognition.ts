import { supabase } from "@/integrations/supabase/client";

type Book = {
  book_id: string;
  title: string;
  author: string;
  category: string;
  availability: string;
};

type RecognitionResult =
  | { status: "no_book" }
  | { status: "unknown"; detected: { title: string | null; author: string | null } }
  | { status: "match"; book: Book; detected: { title: string | null; author: string | null } };

let workerPromise: Promise<any> | null = null;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(/\s+/).filter((word) => word.length > 2));
}

function similarity(a: string, b: string) {
  const aa = tokens(a);
  const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  for (const word of aa) if (bb.has(word)) common++;
  return (2 * common) / (aa.size + bb.size);
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Tesseract.js runs OCR in the browser. It does not use Lovable credits or an AI API.
      // The library/worker/model are downloaded from jsDelivr the first time scanning is used.
      const tesseractUrl = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/+esm";
      const { createWorker } = await import(/* @vite-ignore */ tesseractUrl);
      const worker = await createWorker("eng", 1, {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
      });
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
      });
      return worker;
    })();
  }
  return workerPromise;
}

function cropForOcr(image: string) {
  return new Promise<string>((resolve, reject) => {
    const source = new Image();
    source.onload = () => {
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / source.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not prepare image"));
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    source.onerror = () => reject(new Error("Could not read camera image"));
    source.src = image;
  });
}

export async function recognizeBook(image: string): Promise<RecognitionResult> {
  const { data: books, error } = await supabase
    .from("books")
    .select("book_id, title, author, category, availability");
  if (error) throw new Error(error.message);

  const catalog = (books ?? []) as Book[];
  if (!catalog.length) return { status: "unknown", detected: { title: null, author: null } };

  const worker = await getWorker();
  const preparedImage = await cropForOcr(image);
  const { data } = await worker.recognize(preparedImage);
  const text = data.text.replace(/\s+/g, " ").trim();

  if (!text || text.length < 3) return { status: "no_book" };

  // Match OCR text against the local catalogue. No book data is sent to an AI service.
  let best: { book: Book; score: number } | null = null;
  for (const book of catalog) {
    const titleScore = similarity(text, book.title);
    const authorScore = similarity(text, book.author);
    const combined = Math.max(titleScore, titleScore * 0.75 + authorScore * 0.25);
    if (!best || combined > best.score) best = { book, score: combined };
  }

  // Require a reasonably strong match so random text does not issue the wrong book.
  if (!best || best.score < 0.34) {
    return {
      status: "unknown",
      detected: { title: text.slice(0, 160), author: null },
    };
  }

  return {
    status: "match",
    book: best.book,
    detected: { title: best.book.title, author: best.book.author },
  };
}
