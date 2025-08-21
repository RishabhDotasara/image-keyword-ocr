"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Upload, Search, Loader2 } from "lucide-react"
import Tesseract from "tesseract.js"

interface DetectedWord {
  text: string
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

export default function KeywordDetector() {
  const [image, setImage] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [detectedWords, setDetectedWords] = useState<DetectedWord[]>([])
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
        setDetectedWords([])
        setMatchedKeywords([])
      }
      reader.readAsDataURL(file)
    }
  }

  const processImage = async () => {
    if (!image || !keywords.trim()) return

    setIsProcessing(true)
    setDetectedWords([])
    setMatchedKeywords([])

    try {
      console.log("[v0] Starting OCR processing...")
      const { data } = await Tesseract.recognize(image, "eng", {
        logger: (m) => console.log("[v0] OCR Progress:", m),
      })

      console.log("[v0] OCR completed, processing data structure...")
      console.log("[v0] Full OCR text detected:", data.text)
      console.log("[v0] OCR confidence:", data.confidence)

      console.log("[v0] Full data object keys:", Object.keys(data))
      console.log("[v0] Data.words exists:", !!data.words)
      console.log("[v0] Data.words length:", data.words?.length || 0)
      console.log("[v0] Data.blocks exists:", !!data.blocks)
      console.log("[v0] Data.blocks length:", data.blocks?.length || 0)

      if (data.words && data.words.length > 0) {
        console.log("[v0] Sample word structure:", JSON.stringify(data.words[0], null, 2))
      }

      if (data.blocks && data.blocks.length > 0) {
        console.log("[v0] Sample block structure:", JSON.stringify(data.blocks[0], null, 2))
      }

      const keywordList = keywords
        .toLowerCase()
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0)

      console.log("[v0] Keywords to search for:", keywordList)

      const words: DetectedWord[] = []
      const matched: string[] = []

      if (data.blocks && data.blocks.length > 0) {
        console.log("[v0] Processing blocks hierarchy for word-level bounding boxes...")

        data.blocks.forEach((block, blockIndex) => {
          console.log(`[v0] Processing block ${blockIndex}`)
          block.paragraphs?.forEach((paragraph, paragraphIndex) => {
            console.log(`[v0] Processing paragraph ${paragraphIndex}`)
            paragraph.lines?.forEach((line, lineIndex) => {
              console.log(`[v0] Processing line ${lineIndex}`)
              line.words?.forEach((word, wordIndex) => {
                console.log(`[v0] Processing word ${wordIndex}: "${word.text}"`)
                console.log(`[v0] Word bbox:`, word.bbox)

                if (word.bbox && typeof word.bbox === "object") {
                  const wordText = word.text.toLowerCase().replace(/[^\w\s]/g, "")

                  keywordList.forEach((keyword) => {
                    if (wordText.includes(keyword) && keyword.length > 0) {
                      console.log("[v0] BBOX MATCH FOUND! Word:", word.text, "matches keyword:", keyword)
                      console.log("[v0] Using real bbox coordinates:", word.bbox)

                      words.push({
                        text: word.text,
                        bbox: {
                          x0: word.bbox.x0,
                          y0: word.bbox.y0,
                          x1: word.bbox.x1,
                          y1: word.bbox.y1,
                        },
                      })
                      if (!matched.includes(keyword)) {
                        matched.push(keyword)
                      }
                    }
                  })
                } else {
                  console.log("[v0] Word has no bbox data:", word.text)
                }
              })
            })
          })
        })
      } else if (data.words && data.words.length > 0) {
        console.log("[v0] Processing direct words array...")

        data.words.forEach((word, wordIndex) => {
          console.log(`[v0] Direct word ${wordIndex}: "${word.text}"`)
          console.log(`[v0] Direct word bbox:`, word.bbox)

          if (word.bbox && typeof word.bbox === "object") {
            const wordText = word.text.toLowerCase().replace(/[^\w\s]/g, "")

            keywordList.forEach((keyword) => {
              if (wordText.includes(keyword) && keyword.length > 0) {
                console.log("[v0] DIRECT BBOX MATCH FOUND! Word:", word.text, "matches keyword:", keyword)
                console.log("[v0] Using real bbox coordinates:", word.bbox)

                words.push({
                  text: word.text,
                  bbox: {
                    x0: word.bbox.x0,
                    y0: word.bbox.y0,
                    x1: word.bbox.x1,
                    y1: word.bbox.y1,
                  },
                })
                if (!matched.includes(keyword)) {
                  matched.push(keyword)
                }
              }
            })
          } else {
            console.log("[v0] Direct word has no bbox data:", word.text)
          }
        })
      } else {
        console.log("[v0] No structured word data available - using text-only matching without bounding boxes")
        if (data.text && data.text.trim()) {
          const textWords = data.text.toLowerCase().split(/\s+/)
          keywordList.forEach((keyword) => {
            textWords.forEach((textWord) => {
              const cleanWord = textWord.replace(/[^\w]/g, "")
              if (cleanWord.includes(keyword) && keyword.length > 0) {
                console.log("[v0] Text-based match found:", textWord, "contains", keyword)
                if (!matched.includes(keyword)) {
                  matched.push(keyword)
                }
              }
            })
          })
        }
      }

      console.log("[v0] Total words with bounding boxes found:", words.length)
      console.log("[v0] Matched keywords:", matched)

      setDetectedWords(words)
      setMatchedKeywords(matched)
      if (words.length > 0) {
        drawBoundingBoxes(words)
      }
    } catch (error) {
      console.error("[v0] OCR Error:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const drawBoundingBoxes = (words: DetectedWord[]) => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const displayedWidth = img.clientWidth
    const displayedHeight = img.clientHeight
    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight

    canvas.width = displayedWidth
    canvas.height = displayedHeight

    const scaleX = displayedWidth / naturalWidth
    const scaleY = displayedHeight / naturalHeight

    console.log(
      "[v0] Canvas scaling - Natural:",
      naturalWidth,
      "x",
      naturalHeight,
      "Displayed:",
      displayedWidth,
      "x",
      displayedHeight,
    )
    console.log("[v0] Scale factors - X:", scaleX, "Y:", scaleY)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 2
    ctx.fillStyle = "rgba(239, 68, 68, 0.2)"

    words.forEach((word, index) => {
      const { x0, y0, x1, y1 } = word.bbox

      const scaledX0 = x0 * scaleX
      const scaledY0 = y0 * scaleY
      const scaledX1 = x1 * scaleX
      const scaledY1 = y1 * scaleY

      const width = scaledX1 - scaledX0
      const height = scaledY1 - scaledY0

      console.log(
        `[v0] Drawing box ${index}: Original (${x0}, ${y0}, ${x1}, ${y1}) -> Scaled (${scaledX0}, ${scaledY0}, ${scaledX1}, ${scaledY1})`,
      )

      ctx.fillRect(scaledX0, scaledY0, width, height)
      ctx.strokeRect(scaledX0, scaledY0, width, height)
    })
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Keyword Detector</h1>
          <p className="text-muted-foreground">Upload an image and enter keywords to detect and highlight them</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload & Configure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="image-upload">Upload Image</Label>
              <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                type="text"
                placeholder="e.g., hello, world, text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button onClick={processImage} disabled={!image || !keywords.trim() || isProcessing} className="w-full">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Detect Keywords
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {matchedKeywords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">Found keywords: {matchedKeywords.join(", ")}</p>
              <p className="text-sm text-muted-foreground">Detected {detectedWords.length} instances</p>
            </CardContent>
          </Card>
        )}

        {image && (
          <Card>
            <CardHeader>
              <CardTitle>Image with Detected Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative inline-block">
                <img
                  ref={imageRef}
                  src={image || "/placeholder.svg"}
                  alt="Uploaded"
                  className="max-w-full h-auto"
                  onLoad={() => {
                    if (detectedWords.length > 0) {
                      drawBoundingBoxes(detectedWords)
                    }
                  }}
                />
                <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
