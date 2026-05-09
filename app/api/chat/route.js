import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file'
          },
          content: {
            type: 'string',
            description: 'The content to write'
          }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a terminal command',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to run'
          }
        },
        required: ['command']
      }
    }
  }
]

async function executeToolCall(name, argsStr, mode) {
  let result
  try {
    let args;
    try {
        args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
    } catch (e) {
        // Handle malformed JSON safely
        args = typeof argsStr === 'string' ? JSON.parse(argsStr.substring(0, argsStr.lastIndexOf('}') + 1)) : argsStr;
    }

    if (name === 'read_file') {
      const { path } = args
      result = fs.readFileSync(path, 'utf8')
    } else if (name === 'write_file') {
      if (mode === 'planning') {
        result = 'In planning mode, cannot write file without permission.'
      } else {
        const { path, content: fileContent } = args
        fs.writeFileSync(path, fileContent)
        result = 'File written successfully.'
      }
    } else if (name === 'run_command') {
      if (mode === 'planning') {
        result = 'In planning mode, cannot run command without permission.'
      } else {
        const { command } = args
        const { stdout, stderr } = await execAsync(command)
        result = stdout || stderr
      }
    }
  } catch (error) {
    result = `Error: ${error.message}`
  }
  return result
}

export async function POST(request) {
  const { messages, mode, provider, apiKey, localUrl } = await request.json()

  let systemPrompt = 'You are an AI coding assistant. You can help with reading files, writing code, and running commands.'
  if (mode === 'planning') {
    systemPrompt += ' You are in planning mode. You can read files and analyze code, but do not write files or run commands without asking the user for permission first.'
  } else {
    systemPrompt += ' You are in active development mode. You can freely read files, write code, and run commands.'
  }

  try {
    let content = ''

    if (provider === 'openai' || provider === 'local') {
      const clientOptions = {
        apiKey: apiKey || process.env.OPENAI_API_KEY || 'dummy'
      }
      if (provider === 'local') {
        clientOptions.baseURL = localUrl
      }
      const openai = new OpenAI(clientOptions)

      const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages]
      const response = await openai.chat.completions.create({
        model: provider === 'local' ? 'local-model' : 'gpt-4',
        messages: fullMessages,
        tools: tools,
        tool_choice: 'auto'
      })

      const assistantMessage = response.choices[0].message
      content = assistantMessage.content || ''

      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          const { name, arguments: args } = toolCall.function
          const result = await executeToolCall(name, args, mode)
          content += `\nTool result (${name}): ${result}`
        }
      }
    } else if (provider === 'anthropic') {
      const anthropic = new Anthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY
      })

      // format tools for anthropic
      const anthropicTools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }))

      // format messages (Anthropic doesn't allow 'system' in messages array)
      const formattedMessages = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        system: systemPrompt,
        messages: formattedMessages,
        tools: anthropicTools
      })

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text
        } else if (block.type === 'tool_use') {
          const result = await executeToolCall(block.name, block.input, mode)
          content += `\nTool result (${block.name}): ${result}`
        }
      }
    } else if (provider === 'google') {
      const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLE_API_KEY)

      // format tools for google
      const googleTools = [{
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }]

      const model = genAI.getGenerativeModel({
        model: 'gemini-pro',
        tools: googleTools
      })

      const chat = model.startChat({
        history: messages.slice(0, -1).map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          maxOutputTokens: 1024,
        }
      })

      // Prepend system prompt to the latest message for Google since gemini-pro doesn't have a dedicated system prompt in chat
      const latestMessage = messages[messages.length - 1].content
      const response = await chat.sendMessage(`System Prompt: ${systemPrompt}\n\nUser: ${latestMessage}`)

      const result = response.response

      if (result.functionCalls && result.functionCalls()) {
        const calls = result.functionCalls()
        for (const call of calls) {
          const toolResult = await executeToolCall(call.name, call.args, mode)
          content += `\nTool result (${call.name}): ${toolResult}`
        }
      } else {
         content += result.text()
      }
    }

    return Response.json({ response: content })
  } catch (error) {
    return Response.json({ response: `Error: ${error.message}` })
  }
}
