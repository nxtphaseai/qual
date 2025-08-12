"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Brain, Square, Loader2, X } from "lucide-react"
import StreamingMarkdown from "./streaming-markdown"
import EntityText from "./entity-text"

type QuestionAnswer = {
  question: string
  answer: string
  index: number
}

interface AIAnswersPanelProps {
  questions: string[]
  questionAnswers: QuestionAnswer[]
  isAnswering: boolean
  answerProgress: { current: number; total: number }
  currentQuestionIndex: number
  onStartAnswering: () => void
  onStopAnswering: () => void
  onClose: () => void
  researchContext?: {
    topic: string
    contextAnalysis?: string
    model?: string
  }
}

export default function AIAnswersPanel({
  questions,
  questionAnswers,
  isAnswering,
  answerProgress,
  currentQuestionIndex,
  onStartAnswering,
  onStopAnswering,
  onClose,
  researchContext
}: AIAnswersPanelProps) {
  return (
    <div className="h-full flex flex-col bg-gray-50 border-l-2 border-gray-300">
      {/* Header */}
      <Card className="flex-shrink-0 rounded-none border-0 border-b bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">AI Question Analysis</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {questions.length} questions • Topic: {researchContext?.topic || "Research"}
            </div>
            
            {researchContext && (
              <div className="flex items-center gap-2">
                {!isAnswering ? (
                  <Button 
                    onClick={onStartAnswering}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Start Analysis
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={onStopAnswering}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Question {answerProgress.current}/{answerProgress.total}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {isAnswering && (
            <div className="space-y-2">
              <Progress 
                value={answerProgress.total > 0 ? (answerProgress.current / answerProgress.total) * 100 : 0} 
                className="w-full"
              />
              <div className="text-xs text-gray-600 text-center">
                {currentQuestionIndex >= 0 && currentQuestionIndex < questions.length ? (
                  <>Analyzing: "{questions[currentQuestionIndex]}"</>
                ) : (
                  <>Preparing analysis...</>
                )}
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Scrollable Questions */}
      <div className="flex-1 overflow-y-auto">
        <CardContent className="p-4 space-y-4">
          {questions.map((question, i) => {
            const answer = questionAnswers.find(qa => qa.index === i)
            const isCurrentQuestion = currentQuestionIndex === i
            const hasStarted = answer !== undefined
            const isComplete = hasStarted && i < answerProgress.current
            const isWaiting = i > currentQuestionIndex && isAnswering
            
            return (
              <div 
                key={i} 
                className={`border rounded-lg p-4 transition-all duration-200 ${
                  isCurrentQuestion 
                    ? 'border-blue-300 bg-blue-50 shadow-md' 
                    : isComplete 
                      ? 'border-green-200 bg-green-50' 
                      : hasStarted 
                        ? 'border-yellow-200 bg-yellow-50'
                        : isWaiting 
                          ? 'border-gray-200 bg-gray-50' 
                          : 'border-orange-200 bg-orange-50'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <Badge 
                    variant="outline" 
                    className={`flex-shrink-0 ${
                      isCurrentQuestion 
                        ? 'bg-blue-100 text-blue-800 border-blue-300' 
                        : isComplete 
                          ? 'bg-green-100 text-green-800 border-green-300' 
                          : hasStarted 
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                            : isWaiting 
                              ? 'bg-gray-100 text-gray-600 border-gray-300' 
                              : 'bg-orange-100 text-orange-800 border-orange-300'
                    }`}
                  >
                    Q{i + 1}
                    {isCurrentQuestion && <Loader2 className="h-3 w-3 ml-1 animate-spin" />}
                  </Badge>
                  <div className="font-medium text-sm flex-1">
                    <EntityText text={question} className="text-sm font-medium" />
                  </div>
                </div>
                
                {hasStarted ? (
                  <div className="ml-8">
                    <div className="relative">
                      <StreamingMarkdown isComplete={isComplete}>
                        {answer?.answer || ""}
                      </StreamingMarkdown>
                      {isCurrentQuestion && answer?.answer && (
                        <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1 align-text-bottom"></span>
                      )}
                    </div>
                    {isCurrentQuestion && (
                      <div className="text-blue-600 italic text-sm flex items-center gap-2 mt-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs">
                          {answer?.answer ? 'Streaming response...' : 'Starting to generate...'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : isWaiting ? (
                  <div className="ml-8 text-gray-500 italic text-sm">
                    Waiting to be analyzed...
                  </div>
                ) : !isAnswering ? (
                  <div className="ml-8 text-gray-400 text-sm">
                    Click "Start Analysis" to generate response
                  </div>
                ) : (
                  <div className="ml-8 text-orange-600 text-sm">
                    Preparing to analyze...
                  </div>
                )}
              </div>
            )
          })}
          
          {questions.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No questions available for analysis</p>
              <p className="text-sm">Questions will appear here when research is complete</p>
            </div>
          )}
        </CardContent>
      </div>
    </div>
  )
}