#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

dotenv.config({ path: path.join(__dirname, '.env') });

interface Message {
  role: 'system' | 'user';
  content: string;
}

interface LocalRequestData {
  model: string;
  messages: Message[];
  stream: boolean;
}

interface NvidiaRequestData {
  model: string;
  messages: Message[];
  temperature: number;
  top_p: number;
  max_tokens: number;
  seed: number;
  stream: boolean;
  chat_template_kwargs: {
    thinking: boolean;
  };
}

interface LocalResponseData {
  message?: {
    content?: string;
  };
}

interface NvidiaResponseData {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

const args: string[] = process.argv.slice(2);
const useLocal: boolean = args.includes('--local');
const commandArgs: string[] = useLocal ? args.filter((arg: string) => arg !== '--local') : args;
const prompt: string = commandArgs.join(' ');

if (!prompt) {
  console.error('Please provide a command');
  process.exit(1);
}

function makeLocalRequest(): void {
  const postData: string = JSON.stringify({
    model: process.env.LOCAL_MODEL || 'ministral-3:3b',
    messages: [
      { role: 'system', content: 'Convert natural language to bash commands. Output only the command.' },
      { role: 'user', content: prompt }
    ],
    stream: true
  } as LocalRequestData);

  const req: http.ClientRequest = http.request({
    hostname: 'localhost',
    port: 11434,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res: http.IncomingMessage) => {
    let buffer: string = '';
    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines: string[] = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach((line: string) => {
        if (line.trim()) {
          try {
            const data: LocalResponseData = JSON.parse(line);
            if (data.message?.content) process.stdout.write(data.message.content);
          } catch (e) {}
        }
      });
    });
    res.on('end', () => {
      if (buffer.trim()) {
        try {
          const data: LocalResponseData = JSON.parse(buffer);
          if (data.message?.content) process.stdout.write(data.message.content);
        } catch (e) {}
      }
    });
  });

  req.setTimeout(30000, () => req.abort());
  req.on('error', (e: Error) => console.error('Error:', e.message));
  req.write(postData);
  req.end();
}

function makeNvidiaRequest(): void {
  const postData: string = JSON.stringify({
    model: process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-v3.1-terminus",
    messages: [
      {
        role: "system",
        content: "Convert natural language to bash commands. Output ONLY the command, nothing else. No explanations, no formatting, no code blocks, no additional text. Just the raw command."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.2,
    top_p: 0.7,
    max_tokens: 8192,
    seed: 42,
    stream: true,
    chat_template_kwargs: {
      thinking: false
    }
  } as NvidiaRequestData);

  const options: https.RequestOptions = {
    hostname: 'integrate.api.nvidia.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req: http.ClientRequest = https.request(options, (res: http.IncomingMessage) => {
    let buffer: string = '';
    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines: string[] = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach((line: string) => {
        if (line.trim() && line.startsWith('data: ')) {
          const dataStr: string = line.slice(6);
          if (dataStr === '[DONE]') return;
          try {
            const data: NvidiaResponseData = JSON.parse(dataStr);
            if (data.choices?.[0]?.delta?.content) {
              process.stdout.write(data.choices[0].delta.content);
            }
          } catch (e) {}
        }
      });
    });
    res.on('end', () => {
      if (buffer.trim()) {
        const lines: string[] = buffer.split('\n');
        lines.forEach((line: string) => {
          if (line.trim() && line.startsWith('data: ')) {
            const dataStr: string = line.slice(6);
            if (dataStr === '[DONE]') return;
            try {
              const data: NvidiaResponseData = JSON.parse(dataStr);
              if (data.choices?.[0]?.delta?.content) {
                process.stdout.write(data.choices[0].delta.content);
              }
            } catch (e) {}
          }
        });
      }
    });
  });

  req.setTimeout(30000, () => req.abort());
  req.on('error', (e: Error) => {
    console.error('NVIDIA API error:', e.message);
    console.error('Falling back to local API...');
    makeLocalRequest();
  });
  req.write(postData);
  req.end();
}

if (useLocal) {
  makeLocalRequest();
} else {
  makeNvidiaRequest();
}