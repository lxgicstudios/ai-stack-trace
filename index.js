#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import OpenAI from 'openai';
import fs from 'fs/promises';
import readline from 'readline';

const VERSION = '1.0.0';

program
  .name('ai-stack-trace')
  .description('AI-powered stack trace analyzer - paste errors, get solutions')
  .version(VERSION)
  .option('-f, --file <path>', 'Read error from file')
  .option('-c, --context <files>', 'Include source files for context (comma-separated)')
  .option('-l, --language <lang>', 'Language/runtime hint (node, python, java, etc)')
  .option('--json', 'Output as JSON')
  .parse();

const opts = program.opts();

function parseStackTrace(trace) {
  const info = {
    errorType: null,
    errorMessage: null,
    frames: [],
    raw: trace
  };
  
  // Common error patterns
  const errorPatterns = [
    // JavaScript/Node
    /^(\w*Error):\s*(.+)$/m,
    // Python
    /^(\w*Error|\w*Exception):\s*(.+)$/m,
    // Java
    /^([\w.]+Exception|[\w.]+Error):\s*(.+)$/m,
    // Generic
    /^(Error|Exception):\s*(.+)$/m
  ];
  
  for (const pattern of errorPatterns) {
    const match = trace.match(pattern);
    if (match) {
      info.errorType = match[1];
      info.errorMessage = match[2];
      break;
    }
  }
  
  // Parse stack frames
  // JavaScript: at functionName (file:line:col) or at file:line:col
  const jsFrameRegex = /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/g;
  let match;
  while ((match = jsFrameRegex.exec(trace)) !== null) {
    info.frames.push({
      function: match[1] || '<anonymous>',
      file: match[2],
      line: parseInt(match[3]),
      column: parseInt(match[4])
    });
  }
  
  // Python: File "path", line N, in function
  const pyFrameRegex = /File "(.+?)", line (\d+), in (.+)/g;
  while ((match = pyFrameRegex.exec(trace)) !== null) {
    info.frames.push({
      file: match[1],
      line: parseInt(match[2]),
      function: match[3]
    });
  }
  
  // Java: at package.Class.method(File.java:line)
  const javaFrameRegex = /at\s+([\w.$]+)\(([\w.]+):(\d+)\)/g;
  while ((match = javaFrameRegex.exec(trace)) !== null) {
    info.frames.push({
      function: match[1],
      file: match[2],
      line: parseInt(match[3])
    });
  }
  
  return info;
}

async function readFromStdin() {
  return new Promise((resolve) => {
    let input = '';
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    console.log(chalk.cyan('Paste your stack trace (Ctrl+D or empty line to finish):\n'));
    
    let emptyLines = 0;
    rl.on('line', (line) => {
      if (line === '') {
        emptyLines++;
        if (emptyLines >= 2) {
          rl.close();
          return;
        }
      } else {
        emptyLines = 0;
      }
      input += line + '\n';
    });
    
    rl.on('close', () => {
      resolve(input.trim());
    });
  });
}

async function getSourceContext(files) {
  const context = [];
  const fileList = files.split(',').map(f => f.trim());
  
  for (const file of fileList) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n').slice(0, 100); // First 100 lines
      context.push({
        file,
        content: lines.join('\n')
      });
    } catch {
      // File not found, skip
    }
  }
  
  return context;
}

async function analyzeWithAI(stackInfo, sourceContext = []) {
  if (!process.env.OPENAI_API_KEY) {
    console.error(chalk.red('\n❌ OPENAI_API_KEY environment variable required'));
    console.log(chalk.gray('Set it with: export OPENAI_API_KEY=your-key\n'));
    process.exit(1);
  }
  
  const openai = new OpenAI();
  
  let contextStr = '';
  if (sourceContext.length > 0) {
    contextStr = '\n\nRelevant source code:\n' + sourceContext.map(c => 
      `--- ${c.file} ---\n${c.content}`
    ).join('\n\n');
  }
  
  const languageHint = opts.language ? `\nRuntime/Language: ${opts.language}` : '';
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert debugger. Analyze stack traces and provide clear, actionable solutions. Structure your response as:

1. **Error Summary**: One-line description
2. **Root Cause**: What's actually happening
3. **Solution**: Step-by-step fix (with code if helpful)
4. **Prevention**: How to avoid this in the future

Be concise and practical. Skip obvious things.`
      },
      {
        role: 'user',
        content: `Analyze this error:

Error Type: ${stackInfo.errorType || 'Unknown'}
Message: ${stackInfo.errorMessage || 'No message'}
${languageHint}

Stack Trace:
${stackInfo.raw}
${contextStr}`
      }
    ],
    max_tokens: 1500
  });
  
  return response.choices[0].message.content;
}

async function main() {
  console.log(chalk.bold.red('\n🔥 AI Stack Trace Analyzer\n'));
  
  let stackTrace;
  
  // Get stack trace from file or stdin
  if (opts.file) {
    try {
      stackTrace = await fs.readFile(opts.file, 'utf-8');
    } catch (err) {
      console.error(chalk.red(`Cannot read file: ${opts.file}`));
      process.exit(1);
    }
  } else if (!process.stdin.isTTY) {
    // Piped input
    stackTrace = await readFromStdin();
  } else {
    // Interactive mode
    stackTrace = await readFromStdin();
  }
  
  if (!stackTrace || stackTrace.trim().length === 0) {
    console.error(chalk.red('No stack trace provided'));
    console.log(chalk.gray('\nUsage:'));
    console.log(chalk.gray('  npx ai-stack-trace < error.log'));
    console.log(chalk.gray('  npx ai-stack-trace -f error.log'));
    console.log(chalk.gray('  npx ai-stack-trace  # then paste'));
    process.exit(1);
  }
  
  // Parse the stack trace
  const stackInfo = parseStackTrace(stackTrace);
  
  // Show parsed info
  if (stackInfo.errorType) {
    console.log(chalk.red(`${stackInfo.errorType}: ${stackInfo.errorMessage || ''}`));
  }
  
  if (stackInfo.frames.length > 0) {
    console.log(chalk.gray(`\n📍 ${stackInfo.frames.length} stack frames detected`));
    const topFrame = stackInfo.frames[0];
    if (topFrame) {
      console.log(chalk.gray(`   Top: ${topFrame.function} at ${topFrame.file}:${topFrame.line}`));
    }
  }
  
  // Get source context if provided
  let sourceContext = [];
  if (opts.context) {
    sourceContext = await getSourceContext(opts.context);
  }
  
  // AI Analysis
  const spinner = ora('Analyzing error...').start();
  
  try {
    const analysis = await analyzeWithAI(stackInfo, sourceContext);
    spinner.succeed('Analysis complete\n');
    
    if (opts.json) {
      console.log(JSON.stringify({
        errorType: stackInfo.errorType,
        errorMessage: stackInfo.errorMessage,
        frames: stackInfo.frames,
        analysis
      }, null, 2));
    } else {
      console.log(chalk.cyan('━'.repeat(50)));
      console.log(analysis);
      console.log(chalk.cyan('━'.repeat(50)));
    }
    
  } catch (err) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

main();
