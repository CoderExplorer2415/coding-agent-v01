import OpenAI from 'openai'
import fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

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

export async function POST(request) {
  const { messages, mode } = await request.json()

  let systemPrompt = 'You are an AI coding assistant. You can help with reading files, writing code, and running commands.'
  if (mode === 'planning') {
    systemPrompt += ' You are in planning mode. You can read files and analyze code, but do not write files or run commands without asking the user for permission first.'
  } else {
    systemPrompt += ' You are in active development mode. You can freely read files, write code, and run commands.'
  }

  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages]

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: fullMessages,
      tools: tools,
      tool_choice: 'auto'
    })

    const assistantMessage = response.choices[0].message
    let content = assistantMessage.content || ''

    if (assistantMessage.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        const { name, arguments: args } = toolCall.function
        let result
        try {
          if (name === 'read_file') {
            const { path } = JSON.parse(args)
            result = fs.readFileSync(path, 'utf8')
          } else if (name === 'write_file') {
            if (mode === 'planning') {
              result = 'In planning mode, cannot write file without permission.'
            } else {
              const { path, content: fileContent } = JSON.parse(args)
              fs.writeFileSync(path, fileContent)
              result = 'File written successfully.'
            }
          } else if (name === 'run_command') {
            if (mode === 'planning') {
              result = 'In planning mode, cannot run command without permission.'
            } else {
              const { command } = JSON.parse(args)
              const { stdout, stderr } = await execAsync(command)
              result = stdout || stderr
            }
          }
        } catch (error) {
          result = `Error: ${error.message}`
        }
        content += `\nTool result (${name}): ${result}`
      }
    }

    return Response.json({ response: content })
  } catch (error) {
    return Response.json({ response: `Error: ${error.message}` })
  }
}