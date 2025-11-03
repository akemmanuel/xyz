# NLBAH - Natural Language to Bash Helper

A CLI tool that converts natural language commands into bash commands using AI models.

## Features

- Convert natural language to bash commands
- Support for local Ollama models and NVIDIA API
- Fallback mechanism (NVIDIA API → Local)
- Streaming responses for real-time output
- Environment-based configuration

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your configuration:
   ```env
   # NVIDIA API Configuration
   NVIDIA_API_KEY=your_nvidia_api_key_here
   
   # Model Configuration
   LOCAL_MODEL=gemma3:4b
   NVIDIA_MODEL=deepseek-ai/deepseek-v3.1-terminus
   ```

## Usage

### Using NVIDIA API (default)
```bash
nlbah "list all files in current directory"
```

### Using local Ollama model
```bash
nlbah --local "list all files in current directory"
```

### Using the binary aliases
```bash
xyz "create a new directory called test"
asd --local "show system information"
```

## Configuration

### Environment Variables

- `NVIDIA_API_KEY`: Your NVIDIA API key for cloud-based AI models
- `LOCAL_MODEL`: The Ollama model to use locally (default: `gemma3:4b`)
- `NVIDIA_MODEL`: The NVIDIA model to use (default: `deepseek-ai/deepseek-v3.1-terminus`)

### Local Setup

To use the local model, you need:
1. [Ollama](https://ollama.ai/) installed and running
2. The specified model pulled (e.g., `ollama pull gemma3:4b`)

## How It Works

1. The tool sends your natural language prompt to an AI model
2. The AI model converts it to a bash command
3. The command is streamed back to your terminal in real-time
4. If the NVIDIA API fails, it automatically falls back to the local model

## Examples

```bash
# Find large files
nlbah "find files larger than 100MB"

# System monitoring
nlbah "show memory usage"

# File operations
nlbah "compress all log files in /var/log"

# Development tasks
nlbah "run all tests in the test directory"
```

## Scripts

- `npm test`: Run tests (placeholder - add your tests)
- `nlbah`: Main CLI command
- `xyz`: Alias for nlbah
- `asd`: Alias for nlbah

## License

ISC