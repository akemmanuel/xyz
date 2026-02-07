#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
const https = require("https");
const http = require("http");
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const args = process.argv.slice(2);
const useLocal = args.includes('--local');
const commandArgs = useLocal ? args.filter((arg) => arg !== '--local') : args;
const prompt = commandArgs.join(' ');
if (!prompt) {
    console.error('Please provide a command');
    process.exit(1);
}
function makeLocalRequest() {
    const postData = JSON.stringify({
        model: process.env.LOCAL_MODEL || 'ministral-3:3b',
        messages: [
            { role: 'system', content: 'Convert natural language to bash commands. Output only the command.' },
            { role: 'user', content: prompt }
        ],
        stream: true
    });
    const req = http.request({
        hostname: 'localhost',
        port: 11434,
        path: '/api/chat',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            lines.forEach((line) => {
                if (line.trim()) {
                    try {
                        const data = JSON.parse(line);
                        if (data.message?.content)
                            process.stdout.write(data.message.content);
                    }
                    catch (e) { }
                }
            });
        });
        res.on('end', () => {
            if (buffer.trim()) {
                try {
                    const data = JSON.parse(buffer);
                    if (data.message?.content)
                        process.stdout.write(data.message.content);
                }
                catch (e) { }
            }
        });
    });
    req.setTimeout(30000, () => req.abort());
    req.on('error', (e) => console.error('Error:', e.message));
    req.write(postData);
    req.end();
}
function makeNvidiaRequest() {
    const postData = JSON.stringify({
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
    });
    const options = {
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
    const req = https.request(options, (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            lines.forEach((line) => {
                if (line.trim() && line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]')
                        return;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.choices?.[0]?.delta?.content) {
                            process.stdout.write(data.choices[0].delta.content);
                        }
                    }
                    catch (e) { }
                }
            });
        });
        res.on('end', () => {
            if (buffer.trim()) {
                const lines = buffer.split('\n');
                lines.forEach((line) => {
                    if (line.trim() && line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]')
                            return;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.choices?.[0]?.delta?.content) {
                                process.stdout.write(data.choices[0].delta.content);
                            }
                        }
                        catch (e) { }
                    }
                });
            }
        });
    });
    req.setTimeout(30000, () => req.abort());
    req.on('error', (e) => {
        console.error('NVIDIA API error:', e.message);
        console.error('Falling back to local API...');
        makeLocalRequest();
    });
    req.write(postData);
    req.end();
}
if (useLocal) {
    makeLocalRequest();
}
else {
    makeNvidiaRequest();
}
