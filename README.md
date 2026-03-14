# ai-stack-trace

AI-powered stack trace analyzer. Paste errors, get solutions.

## Install & Run

```bash
npx ai-stack-trace
```

## What It Does

- Parses stack traces from any language (JavaScript, Python, Java, etc.)
- Identifies the error type and root cause
- Provides step-by-step solutions
- Suggests prevention strategies

## Usage

```bash
# Interactive - paste your error
npx ai-stack-trace

# From file
npx ai-stack-trace -f error.log

# Pipe from command
npm test 2>&1 | npx ai-stack-trace

# Include source context for better analysis
npx ai-stack-trace -f error.log -c src/index.js,src/utils.js
```

## Options

```bash
Options:
  -f, --file <path>      Read error from file
  -c, --context <files>  Include source files (comma-separated)
  -l, --language <lang>  Runtime hint (node, python, java)
  --json                 Output as JSON
```

## Example

```bash
$ npx ai-stack-trace -f error.log

🔥 AI Stack Trace Analyzer

TypeError: Cannot read property 'map' of undefined

📍 5 stack frames detected
   Top: renderList at src/components/List.jsx:24

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Error Summary**: Attempting to call .map() on undefined data

**Root Cause**: The `items` prop is undefined when the component
renders, likely because data hasn't loaded yet.

**Solution**:
1. Add a guard before mapping:
   ```jsx
   {items?.map(item => <Item key={item.id} {...item} />)}
   ```
2. Or provide a default value:
   ```jsx
   const { items = [] } = props;
   ```

**Prevention**: Always initialize array state/props with empty
arrays, not undefined. Use TypeScript for type safety.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Requirements

- Node.js 18+
- `OPENAI_API_KEY` environment variable

## FAQ

### What languages does ai-stack-trace support?

ai-stack-trace parses errors from JavaScript, TypeScript, Python, Java, Go, Rust, Ruby, PHP, and C#. The AI analysis works with any language that produces readable stack traces.

### Does it send my code to OpenAI?

Only the stack trace and optionally provided context files are sent. Your full codebase is never uploaded. Use `--no-ai` for fully offline parsing.

### How is this different from searching the error on Google?

ai-stack-trace analyzes your specific code context, not generic solutions. It reads your actual files and suggests fixes tailored to your codebase.

### Can I use a different AI provider?

Currently OpenAI only. Anthropic and local models are planned for future releases.

## License

MIT - Built by [LXGIC Studios](https://github.com/lxgicstudios)
